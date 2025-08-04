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
    const [authorizationEndpoint, setAuthorizationEndpoint] = useState<string | null>(null);
    const [tokenEndpoint, setTokenEndpoint] = useState<string | null>(null);
    const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
    const [authCode, setAuthCode] = useState<string | null>(null);
    const [tokenResponse, setTokenResponse] = useState<any>(null);

    const clientId = "ddd5883d-63eb-4ee7-91b4-0dbe58d2ed39";
    const redirectUri = "http://localhost:3001";

    useEffect(() => {
        let issParam = searchParams.get("iss");
        let launchParam = searchParams.get("launch");

        if (!issParam || !launchParam) {
            const urlParams = new URLSearchParams(window.location.search);
            issParam = issParam || urlParams.get("iss") || sessionStorage.getItem("iss");
            launchParam = launchParam || urlParams.get("launch") || sessionStorage.getItem("launch");
        }

        if (issParam) sessionStorage.setItem("iss", issParam);
        if (launchParam) sessionStorage.setItem("launch", launchParam);

        setIss(issParam);
        setLaunch(launchParam);
    }, [searchParams]);


    useEffect(() => {
        if (!iss || !launch) return;

        const prevIss = sessionStorage.getItem("prev_iss");
        const prevLaunch = sessionStorage.getItem("prev_launch");
        const isNewSession = iss !== prevIss || launch !== prevLaunch;

        if (isNewSession) {
            sessionStorage.removeItem("pkce_code_verifier");
            sessionStorage.removeItem("authorization_endpoint");
            sessionStorage.removeItem("token_endpoint");
            localStorage.removeItem("token_response"); // <-- Add this line

            sessionStorage.setItem("prev_iss", iss);
            sessionStorage.setItem("prev_launch", launch);
        }
    }, [iss, launch]);


    // On mount, try to load endpoints and token from storage
    useEffect(() => {
        const cachedTokenEndpoint = sessionStorage.getItem("token_endpoint");
        if (cachedTokenEndpoint) setTokenEndpoint(cachedTokenEndpoint);
        const cachedAuthorizationEndpoint = sessionStorage.getItem("authorization_endpoint");
        if (cachedAuthorizationEndpoint) setAuthorizationEndpoint(cachedAuthorizationEndpoint);

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

    // Build PKCE and authorization URL
    useEffect(() => {
        if (!iss || !launch || !authorizationEndpoint) return;

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

    // ⏳ Delayed redirect to authorization URL if needed
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        if (
            iss &&
            launch &&
            authorizationUrl &&
            !(tokenResponse?.access_token && tokenResponse.expires_at > Date.now())
        ) {
            timeout = setTimeout(() => {
                window.location.href = authorizationUrl;
            }, 1000); // 1-second delay to ensure parameters are loaded
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [authorizationUrl, iss, launch, tokenResponse]);

    // Extract code from URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        if (code) {
            setAuthCode(code);
        }
    }, []);

    // Exchange code for token
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

    if (tokenResponse?.access_token && tokenResponse.patient && iss) {
        const showBanner = tokenResponse.need_patient_banner !== false;

        return (
            <div style={containerStyle}>
                {showBanner && (
                    <PatientBanner
                        accessToken={tokenResponse.access_token}
                        patientId={tokenResponse.patient}
                        iss={iss}
                    />
                )}
                <PatientVitalSigns
                    patientId={tokenResponse.patient}
                    accessToken={tokenResponse.access_token}
                    fhirServerUrl={iss}
                />
            </div>
        );
    }

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
