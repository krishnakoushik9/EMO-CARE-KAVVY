// File: /api/speed-insights.js
export default async function handler(req, res) {
  if (req.method === "POST") {
    const performanceData = req.body;
    console.log("Performance Data Received:", performanceData);

    // Save the data or send it to another analytics platform
    res.status(200).json({ message: "Data received!" });
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
