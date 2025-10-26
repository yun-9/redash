import React, { useState, useEffect, useCallback } from "react";
import Card from "antd/lib/card";
import Row from "antd/lib/row";
import Col from "antd/lib/col";
import DatePicker from "antd/lib/date-picker";
import Spin from "antd/lib/spin";
import Table from "antd/lib/table";
import Statistic from "antd/lib/statistic";
import moment from "moment";

import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import PageHeader from "@/components/PageHeader";
import Layout from "@/components/layouts/ContentWithSidebar";
import { axios } from "@/services/axios";
import routes from "@/services/routes";

import "./schedule.css";

const { RangePicker } = DatePicker;

function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, "days"),
    moment()
  ]);

  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const [startDate, endDate] = dateRange;
      const response = await axios.get("/api/schedule-stats", {
        params: {
          start_date: startDate.format("YYYY-MM-DD"),
          end_date: endDate.format("YYYY-MM-DD")
        }
      });
      setChartData(response.data);
    } catch (error) {
      console.error("Failed to fetch schedule data:", error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    }
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => moment(date).format("YYYY-MM-DD")
    },
    {
      title: "Scheduled Queries Count",
      dataIndex: "count",
      key: "count",
      sorter: (a, b) => a.count - b.count,
      render: (count) => <span style={{ fontWeight: "bold", color: "#1890ff" }}>{count}</span>
    }
  ];

  const totalQueries = chartData.reduce((sum, item) => sum + item.count, 0);
  const avgQueries = chartData.length > 0 ? (totalQueries / chartData.length).toFixed(1) : 0;
  const maxQueries = chartData.length > 0 ? Math.max(...chartData.map(d => d.count)) : 0;

  return (
    <Layout>
      <div className="schedule-page">
        <PageHeader title="Schedule" />
        
        <div className="schedule-content">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                title="Date Range Selection"
                size="small"
              >
                <RangePicker
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  format="YYYY-MM-DD"
                  allowClear={false}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Scheduled Queries"
                  value={totalQueries}
                  valueStyle={{ color: "#3f8600" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Average per Day"
                  value={avgQueries}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Peak Day Count"
                  value={maxQueries}
                  valueStyle={{ color: "#cf1322" }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card 
                title="Scheduled Queries Statistics"
              >
                {loading ? (
                  <div style={{ textAlign: "center", padding: "50px 0" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <Table
                    columns={columns}
                    dataSource={chartData.map((item, index) => ({ ...item, key: index }))}
                    pagination={{ pageSize: 15 }}
                    size="middle"
                  />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </Layout>
  );
}

routes.register(
  "Schedule",
  routeWithUserSession({
    path: "/schedule",
    title: "Schedule",
    render: pageProps => <SchedulePage {...pageProps} />
  })
);