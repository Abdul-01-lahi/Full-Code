import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const Canvas = ({ motionDetected }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    const ctx = chartRef.current.getContext("2d");

    // Create a chart
    const chart = new Chart(ctx, {
      type: "bar", // Use a bar chart
      data: {
        labels: ["Motion Status"],
        datasets: [
          {
            label: "Motion Detected",
            data: [motionDetected ? 1 : 0], // 1 for motion, 0 for no motion
            backgroundColor: motionDetected ? "#e74c3c" : "#2ecc71", // Red for motion, green for no motion
            borderColor: motionDetected ? "#c0392b" : "#27ae60",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 1,
          },
        },
      },
    });

    // Cleanup the chart on unmount
    return () => chart.destroy();
  }, [motionDetected]);

  return <canvas ref={chartRef} />;
};

export default Canvas;