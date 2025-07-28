"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import PatientBanner from "./PatientBanner";
import { PatientVitalSigns } from "./PatientVitalSigns";


// PKCE utilities
function base64urlencode(str: ArrayBuffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str) as any))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function pkceChallengeFromVerifier(verifier: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return base64urlencode(digest);
}

function randomString(length: number) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => ("0" + dec.toString(16)).slice(-2))
        .join("")
        .slice(0, length);
}

const PractitionerLaunch = () => {
    const searchParams = useSearchParams();
    const [iss, setIss] = useState<string | null>(null);
    const [launch, setLaunch] = useState<string | null>(null);
    const [authorizationEndpoint, setAuthorizationEndpoint] = useState<string | null>(
        null
    );
    const [tokenEndpoint, setTokenEndpoint] = useState<string | null>(null);
    const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
    const [authCode, setAuthCode] = useState<string | null>(null);
    const [tokenResponse, setTokenResponse] = useState<any>(null);

    const clientId = "ddd5883d-63eb-4ee7-91b4-0dbe58d2ed39";
    const redirectUri = "http://localhost:3001";

    // Extract iss and launch from searchParams or window.location.search
    useEffect(() => {
        let issParam = searchParams.get("iss");
        let launchParam = searchParams.get("launch");
        if (!issParam || !launchParam) {
            const urlParams = new URLSearchParams(window.location.search);
            issParam = urlParams.get("iss");
            launchParam = urlParams.get("launch");
        }
        setIss(issParam);
        setLaunch(launchParam);
    }, [searchParams]);

    // On mount, try to load endpoints from sessionStorage
    useEffect(() => {
        const cachedTokenEndpoint = sessionStorage.getItem("token_endpoint");
        if (cachedTokenEndpoint) setTokenEndpoint(cachedTokenEndpoint);
        const cachedAuthorizationEndpoint = sessionStorage.getItem("authorization_endpoint");
        if (cachedAuthorizationEndpoint) setAuthorizationEndpoint(cachedAuthorizationEndpoint);

        // Load tokenResponse from localStorage if available
        const storedTokenResponse = localStorage.getItem("token_response");
        if (storedTokenResponse) {
            setTokenResponse(JSON.parse(storedTokenResponse));
        }
    }, []);

    // Fetch SMART config and cache endpoints
    useEffect(() => {
        if (!iss || !launch) return;
        axios.get(`${iss}/.well-known/smart-configuration`).then((res) => {
            const authz = res.data.authorization_endpoint ?? null;
            const token = res.data.token_endpoint ?? null;
            setAuthorizationEndpoint(authz);
            setTokenEndpoint(token);
            if (authz) sessionStorage.setItem("authorization_endpoint", authz);
            if (token) sessionStorage.setItem("token_endpoint", token);
        });
    }, [iss, launch]);

    // PKCE and authorization URL construction
    useEffect(() => {
        if (!iss || !launch || !authorizationEndpoint) return;

        // If tokenResponse with access_token exists and not expired, skip building authorization URL
        if (
            tokenResponse?.access_token &&
            tokenResponse.expires_at &&
            tokenResponse.expires_at > Date.now()
        ) {
            return;
        }

        const code_verifier = randomString(64);
        pkceChallengeFromVerifier(code_verifier).then((code_challenge) => {
            sessionStorage.setItem("pkce_code_verifier", code_verifier);
            const url = new URL(authorizationEndpoint);
            url.searchParams.set("client_id", clientId);
            url.searchParams.set("redirect_uri", redirectUri);
            url.searchParams.set(
                "scope",
                "openid fhirUser launch user/Patient.crus user/Observation.crus"
            );
            url.searchParams.set("response_type", "code");
            url.searchParams.set("aud", iss);
            url.searchParams.set("launch", launch);
            url.searchParams.set("code_challenge", code_challenge);
            url.searchParams.set("code_challenge_method", "S256");
            setAuthorizationUrl(url.toString());
        });
    }, [iss, launch, authorizationEndpoint, tokenResponse]);

    // Redirect to authorization URL if needed
    useEffect(() => {
        // Only redirect if no valid tokenResponse with non-expired token
        if (
            iss &&
            launch &&
            authorizationUrl &&
            !(tokenResponse?.access_token && tokenResponse.expires_at > Date.now())
        ) {
            window.location.href = authorizationUrl;
        }
    }, [authorizationUrl, iss, launch, tokenResponse]);

    // Extract code from URL on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        if (code) {
            setAuthCode(code);
            // Optionally: clean code param from URL
            // window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Exchange code for token when code and tokenEndpoint are present
    useEffect(() => {
        if (authCode && tokenEndpoint) {
            const codeVerifier = sessionStorage.getItem("pkce_code_verifier");
            if (!codeVerifier) {
                setTokenResponse({ error: "Missing PKCE code_verifier" });
                return;
            }
            const params = new URLSearchParams();
            params.set("grant_type", "authorization_code");
            params.set("code", authCode);
            params.set("redirect_uri", redirectUri);
            params.set("client_id", clientId);
            params.set("code_verifier", codeVerifier);

            axios
                .post(tokenEndpoint, params, {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                })
                .then((res) => {
                    // Add expires_at for token expiry management
                    const expiresAt = Date.now() + (res.data.expires_in ?? 0) * 1000;
                    const tokenData = { ...res.data, expires_at: expiresAt };
                    setTokenResponse(tokenData);
                    localStorage.setItem("token_response", JSON.stringify(tokenData));
                })
                .catch((err) => {
                    setTokenResponse({ error: err.message, details: err.response?.data });
                });
        }
    }, [authCode, tokenEndpoint]);

    const containerStyle = {
        maxWidth: 800,
        margin: "40px auto",
        padding: 30,
        borderRadius: 12,
        backgroundColor: "#f9faff",
        boxShadow: "0 10px 25px rgba(100, 149, 237, 0.15)",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#102a43",
    };

    const sectionStyle = {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "2px solid #69b3f9",
    };

    const labelStyle = {
        fontWeight: 700,
        fontSize: 16,
        color: "#147efb",
        marginBottom: 6,
        display: "block",
    };

    const valueStyle = {
        backgroundColor: "#ffffff",
        padding: "10px 15px",
        borderRadius: 6,
        border: "1px solid #c9e0ff",
        fontSize: 15,
        color: "#1b2838",
        userSelect: "text" as const,
        wordBreak: "break-word" as const,
    };

    const preStyle = {
        backgroundColor: "#eaf3ff",
        borderRadius: 8,
        padding: 16,
        fontSize: 14,
        color: "#2e4a8c",
        overflowX: "auto" as const,
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-word" as const,
        border: "1px solid #c2d1f7",
        maxHeight: 300,
    };

    const errorStyle = {
        backgroundColor: "#ffe6e6",
        color: "#b00020",
        border: "1px solid #f1a1a8",
        borderRadius: 8,
        padding: 16,
        fontWeight: "bold",
        marginBottom: 24,
    };

    // Show error if token fetch failed
    if (tokenResponse?.error) {
        return (
            <div style={{ ...containerStyle, maxWidth: 600 }}>
                <div style={errorStyle}>
                    <strong>Error:</strong> {tokenResponse.error}
                    {tokenResponse.details && (
                        <pre style={{ marginTop: 12, ...preStyle }}>
                            {JSON.stringify(tokenResponse.details, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        );
    }

    // Show PatientBanner and PatientVitalSigns if token and patient available
    if (tokenResponse?.access_token && tokenResponse.patient && iss) {
        return (
            <div style={containerStyle}>
                <PatientBanner
                    accessToken={tokenResponse.access_token}
                    patientId={tokenResponse.patient}
                    iss={iss}
                />
                <PatientVitalSigns
                    patientId={tokenResponse.patient}
                    accessToken={tokenResponse.access_token}
                    fhirServerUrl={iss}
                />
            </div>
        );
    }

    // Default render fallback (show your usual debug info)
    return (
        <div style={containerStyle}>
            <div style={sectionStyle}>
                <label style={labelStyle}>Issuer (iss)</label>
                <div style={valueStyle}>{iss ?? <em>Not provided</em>}</div>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Launch</label>
                <div style={valueStyle}>{launch ?? <em>Not provided</em>}</div>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Authorization Endpoint</label>
                <div style={valueStyle}>
                    {authorizationEndpoint ?? <em>Not loaded</em>}
                </div>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Token Endpoint</label>
                <div style={valueStyle}>{tokenEndpoint ?? <em>Not loaded</em>}</div>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Authorization URL</label>
                <pre style={preStyle}>
                    {authorizationUrl ?? <em>Not available</em>}
                </pre>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Authorization Code</label>
                <div style={valueStyle}>{authCode ?? <em>Not present</em>}</div>
            </div>

            <div style={sectionStyle}>
                <label style={labelStyle}>Token Response</label>
                <pre style={preStyle}>
                    {tokenResponse
                        ? JSON.stringify(tokenResponse, null, 2)
                        : <em>Exchanging code for token...</em>}
                </pre>
            </div>
        </div>
    );
};

export default PractitionerLaunch;
