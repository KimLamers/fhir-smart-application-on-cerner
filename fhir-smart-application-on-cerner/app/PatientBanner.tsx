"use client";
import { useEffect, useState } from "react";

interface PatientBannerProps {
    accessToken: string;
    patientId: string;
    iss: string;
}

const PatientBanner = ({ accessToken, patientId, iss }: PatientBannerProps) => {
    const [patientData, setPatientData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientId || !accessToken || !iss) return;

        const patientUrl = `${iss}/Patient/${patientId}`;

        fetch(patientUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/fhir+json",
            },
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch patient: ${res.status} ${res.statusText}`);
                }
                return res.json();
            })
            .then((data) => {
                setPatientData(data);
            })
            .catch((err) => {
                setError(err.message);
            });
    }, [patientId, accessToken, iss]);

    if (error) {
        return (
            <div
                style={{
                    color: "#ffdddd",
                    padding: "1rem",
                    backgroundColor: "#b71c1c",
                    borderRadius: "6px",
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                }}
            >
                ❌ Failed to fetch patient: {error}
            </div>
        );
    }

    if (!patientData) {
        return (
            <div
                style={{
                    padding: "1rem",
                    fontStyle: "italic",
                    color: "#bbdefb",
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                }}
            >
                Loading patient banner...
            </div>
        );
    }

    const { name, gender, birthDate } = patientData;
    const fullName =
        name && name.length > 0
            ? `${name[0].given?.join(" ") ?? ""} ${name[0].family ?? ""}`
            : "Unknown Patient";

    return (
        <div
            style={{
                backgroundColor: "#0d47a1", // darker blue background
                color: "#e3f2fd", // light blue text for readability
                padding: "1rem 2rem",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                boxShadow: "0 4px 8px rgba(13, 71, 161, 0.4)",
                maxWidth: "100%",
                marginBottom: "1rem",
                userSelect: "none",
                fontWeight: "600",
                fontSize: "1rem",
            }}
        >
            <div>
                <strong>Name:</strong> {fullName}
            </div>
            <div>
                <strong>Gender:</strong> {gender ?? "Unknown"}
            </div>
            <div>
                <strong>Birth Date:</strong> {birthDate ?? "Unknown"}
            </div>
        </div>
    );
};

export default PatientBanner;
