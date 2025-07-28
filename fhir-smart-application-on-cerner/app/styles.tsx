// styles.ts

export const containerStyle = {
    maxWidth: 800,
    margin: "40px auto",
    padding: 30,
    borderRadius: 12,
    backgroundColor: "#ffffff", // main background white
    boxShadow: "0 10px 25px rgba(100, 149, 237, 0.15)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#102a43",
};

export const bannerWrapperStyle = {
    backgroundColor: "#2a74da", // bright friendly blue for banner
    color: "white",
    padding: "20px 25px",
    borderRadius: 12,
    maxWidth: 800,
    margin: "40px auto",
    boxShadow: "0 8px 20px rgba(42, 116, 218, 0.4)",
};

export const errorStyle = {
    color: "red",
    fontWeight: "bold",
};

export const preStyle = {
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
};
