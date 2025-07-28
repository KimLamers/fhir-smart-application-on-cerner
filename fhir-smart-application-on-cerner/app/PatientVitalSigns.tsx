"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";

interface PatientVitalSignsProps {
    patientId: string;
    accessToken: string;
    fhirServerUrl: string;
}

export const PatientVitalSigns: React.FC<PatientVitalSignsProps> = ({
                                                                        patientId,
                                                                        accessToken,
                                                                        fhirServerUrl,
                                                                    }) => {
    const [vitals, setVitals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newValue, setNewValue] = useState("");
    const [newEffective, setNewEffective] = useState("");

    useEffect(() => {
        if (!patientId || !accessToken) return;

        const fetchVitals = async () => {
            setLoading(true);
            setError(null);
            try {
                const url = `${fhirServerUrl}/Observation?patient=${patientId}&category=vital-signs&_count=50`;
                const response = await axios.get(url, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/fhir+json",
                    },
                });

                const entries = response.data.entry || [];
                setVitals(entries.map((entry: any) => entry.resource));
            } catch (err: any) {
                setError(err.message || "Failed to fetch vital signs");
            } finally {
                setLoading(false);
            }
        };

        fetchVitals();
    }, [patientId, accessToken, fhirServerUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newValue || !newEffective) {
            alert("Please enter both temperature value and effective date/time");
            return;
        }

        try {
            const observation = {
                resourceType: "Observation",
                status: "final",
                category: [
                    {
                        coding: [
                            {
                                system: "http://terminology.hl7.org/CodeSystem/observation-category",
                                code: "vital-signs",
                                display: "Vital Signs",
                            },
                        ],
                        text: "Vital Signs",
                    },
                ],
                code: {
                    coding: [
                        {
                            system: "http://loinc.org",
                            code: "8331-1",
                            display: "Temperature Oral",
                        },
                    ],
                    text: "Temperature Oral",
                },
                subject: { reference: `Patient/${patientId}` },
                effectiveDateTime: new Date(newEffective).toISOString(),
                valueQuantity: {
                    value: parseFloat(newValue),
                    unit: "degC",
                    system: "http://unitsofmeasure.org",
                    code: "Cel",
                },
            };

            await axios.post(`${fhirServerUrl}/Observation`, observation, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/fhir+json",
                },
            });

            alert("Vital sign entry created!");
            setShowCreateForm(false);
            setNewValue("");
            setNewEffective("");

            const response = await axios.get(
                `${fhirServerUrl}/Observation?patient=${patientId}&category=vital-signs&_count=50`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/fhir+json",
                    },
                }
            );
            const entries = response.data.entry || [];
            setVitals(entries.map((entry: any) => entry.resource));
            setLoading(false);
        } catch (err: any) {
            alert(`Error creating vital sign: ${err.message || err}`);
        }
    };

    if (loading) return <div>Loading vital signs...</div>;
    if (error) return <div style={{ color: "red" }}>Error: {error}</div>;
    if (vitals.length === 0) return <div>No vital signs found for this patient.</div>;

    return (
        <div style={{ maxWidth: 900, margin: "auto", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
            <h3>Vital Signs</h3>

            <button
                onClick={() => setShowCreateForm((s) => !s)}
                style={{
                    marginBottom: 16,
                    backgroundColor: "#147efb",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 16px",
                    cursor: "pointer",
                }}
            >
                {showCreateForm ? "Cancel" : "Create Vital Signs Entry"}
            </button>

            {showCreateForm && (
                <form onSubmit={handleSubmit} style={{ marginBottom: 24, border: "1px solid #ccc", padding: 16, borderRadius: 6 }}>
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="temperature" style={{ display: "block", marginBottom: 4 }}>
                            Body Temperature (°C):
                        </label>
                        <input
                            id="temperature"
                            type="number"
                            step="0.1"
                            min="25"
                            max="45"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            required
                            style={{ padding: 6, width: "100%", boxSizing: "border-box" }}
                        />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="effectiveDateTime" style={{ display: "block", marginBottom: 4 }}>
                            Effective Date & Time:
                        </label>
                        <input
                            id="effectiveDateTime"
                            type="datetime-local"
                            value={newEffective}
                            onChange={(e) => setNewEffective(e.target.value)}
                            required
                            style={{ padding: 6, width: "100%", boxSizing: "border-box" }}
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            backgroundColor: "#147efb",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            padding: "8px 16px",
                            cursor: "pointer",
                        }}
                    >
                        Submit
                    </button>
                </form>
            )}

            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: 16,
                    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                }}
            >
                <thead>
                <tr style={{ backgroundColor: "#147efb", color: "white" }}>
                    <th style={{ padding: "8px", border: "1px solid #ddd" }}>Date/Time</th>
                    <th style={{ padding: "8px", border: "1px solid #ddd" }}>Observation</th>
                    <th style={{ padding: "8px", border: "1px solid #ddd" }}>Value</th>
                </tr>
                </thead>
                <tbody>
                {vitals.map((obs) => (
                    <tr key={obs.id} style={{ borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "8px", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                            {obs.effectiveDateTime
                                ? new Date(obs.effectiveDateTime).toLocaleString()
                                : "-"}
                        </td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {obs.code?.text || obs.code?.coding?.[0]?.display || "Unknown"}
                        </td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {obs.code?.coding?.some((c: any) => c.code === "85354-9") ? (
                                (() => {
                                    const systolic = obs.component?.find((comp: any) =>
                                        comp.code?.coding?.some((cc: any) => cc.code === "8480-6")
                                    )?.valueQuantity?.value;

                                    const diastolic = obs.component?.find((comp: any) =>
                                        comp.code?.coding?.some((cc: any) => cc.code === "8462-4")
                                    )?.valueQuantity?.value;

                                    const unit = obs.component?.[0]?.valueQuantity?.unit || "";

                                    return systolic !== undefined && diastolic !== undefined
                                        ? `${systolic} / ${diastolic} ${unit}`
                                        : "No value";
                                })()
                            ) : obs.valueQuantity ? (
                                `${obs.valueQuantity.value} ${obs.valueQuantity.unit}`
                            ) : (
                                obs.valueString || "No value"
                            )}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default PatientVitalSigns;
