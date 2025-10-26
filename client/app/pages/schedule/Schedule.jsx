import React, { useEffect, useState, useRef, useCallback } from "react";
import * as d3 from "d3";
import { axios } from "@/services/axios";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import routes from "@/services/routes";
import recordEvent from "@/services/recordEvent";
import Card from "antd/lib/card";
import Spin from "antd/lib/spin";
import Alert from "antd/lib/alert";

import "./Schedule.less";

function Schedule() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef(null);

  const drawChart = useCallback(() => {
    if (!chartRef.current || chartData.length === 0) return;

    d3.select(chartRef.current).selectAll("*").remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = chartRef.current.offsetWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scale
      .ordinal()
      .rangeRoundBands([0, width], 0.2)
      .domain(chartData.map(d => d.label));

    const maxCount = d3.max(chartData, d => d.count) || 10;
    const y = d3.scale
      .linear()
      .domain([0, maxCount])
      .range([height, 0]);

    const xAxis = d3.svg.axis().scale(x).orient("bottom");
    const yAxis = d3.svg.axis().scale(y).orient("left");

    svg
      .append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    svg.append("g").attr("class", "y axis").call(yAxis);

    svg
      .selectAll("rect")
      .data(chartData)
      .enter()
      .append("rect")
      .attr("x", d => x(d.label))
      .attr("y", d => y(d.count))
      .attr("width", x.rangeBand())
      .attr("height", d => height - y(d.count))
      .attr("fill", "#1890ff");
  }, [chartData]);

  const processScheduleData = useCallback((queries) => {
    const now = new Date();
    const hourlyBuckets = {};

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now);
      hour.setHours(now.getHours() + i, 0, 0, 0);
      const hourKey = hour.toISOString().substring(0, 13);
      hourlyBuckets[hourKey] = {
        hour: hour.getHours(),
        count: 0,
        label: `${String(hour.getHours()).padStart(2, "0")}:00`,
      };
    }

    queries.forEach(query => {
      if (query.schedule && query.schedule.interval) {
        const intervalSeconds = query.schedule.interval;
        
        const hoursUntilNext = (intervalSeconds / 3600) % 24;
        const nextRunHour = new Date(now);
        nextRunHour.setHours(now.getHours() + Math.floor(hoursUntilNext), 0, 0, 0);
        
        const hourKey = nextRunHour.toISOString().substring(0, 13);
        
        if (hourlyBuckets[hourKey]) {
          hourlyBuckets[hourKey].count++;
        }
      }
    });

    return Object.values(hourlyBuckets).sort((a, b) => a.hour - b.hour);
  }, []);

  const fetchScheduledQueries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get("api/queries", {
        params: {
          page_size: 1000,
        },
      });

      const queries = response.results || [];
      
      const scheduledQueries = queries.filter(query => query.schedule && query.schedule.interval);

      const scheduleData = processScheduleData(scheduledQueries);
      
      setChartData(scheduleData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching scheduled queries:", err);
      setError("Failed to load scheduled queries. Please try again later.");
      setLoading(false);
    }
  }, [processScheduleData]);

  useEffect(() => {
    recordEvent("view", "page", "schedule");
    fetchScheduledQueries();
  }, [fetchScheduledQueries]);

  useEffect(() => {
    if (chartData.length > 0 && chartRef.current) {
      drawChart();
    }
  }, [chartData, drawChart]);

  return (
    <div className="schedule-page">
      <div className="container">
        <div className="page-header">
          <h3>Scheduled Queries</h3>
          <p className="page-description">
            View the distribution of scheduled queries over the next 24 hours
          </p>
        </div>

        {loading && (
          <div className="loading-container">
            <Spin size="large" />
          </div>
        )}

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            className="m-b-15"
          />
        )}

        {!loading && !error && (
          <Card className="schedule-chart-card">
            <h4>Scheduled Queries by Hour (Next 24 Hours)</h4>
            <div ref={chartRef} className="schedule-chart"></div>
          </Card>
        )}
      </div>
    </div>
  );
}

routes.register(
  "Schedule",
  routeWithUserSession({
    path: "/schedule",
    title: "Schedule",
    render: (pageProps) => <Schedule {...pageProps} />,
  })
);

export default Schedule;
