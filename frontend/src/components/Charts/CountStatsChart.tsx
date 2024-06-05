import type {FC} from "react";
import {useEffect} from "react";
import * as React from "react";
import Chart from "react-apexcharts";
import {Alert, Card, CardContent, CardHeader, Grid, Paper} from "@mui/material";
import {SuspenseLoaderInline} from "../SuspenseLoader";
import type {ICountStats} from "@dbstats/shared/src/stats";
import type {ApexOptions} from "apexcharts";
import distinctColors from "distinct-colors";


type CountStatesChartProps = {
    title: string,
    api: () => Promise<Array<ICountStats>>,
}
const colors = distinctColors({count: 50}).map(c => c.hex());

export const CountStatsChart: FC<CountStatesChartProps> = ({title, api}) => {

    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState(null);
    const [errorMessageLoad, setErrorMessageLoad] = React.useState('');


    function loadStats() {

        const fetchData = async () => {
            setLoading(true);
            const data = await api();

            const state: { options: ApexOptions, series: ApexAxisChartSeries } = {
                options: {
                    colors,
                    legend: {
                        show: false,
                    },
                    title: {text: title, align: "center"},
                    chart: {},
                    plotOptions: {
                        bar: {
                            distributed: true,
                            borderRadius: 4,
                            borderRadiusApplication: 'end',
                            horizontal: true,
                        }
                    }, dataLabels: {
                        style: {fontSize: "14"}
                    },
                    yaxis: {
                        floating: false,
                        labels: {
                            maxWidth: 230,
                            align: 'right',
                            style: {
                                fontSize: "14",
                            },
                        },
                    },
                    xaxis: {
                        categories: data.map(item => item.type),
                        labels: {
                            trim: false,
                            style: {
                                fontSize: "14",
                            },
                        },
                    }
                },
                series: [
                    {
                        name: "",
                        data: data.map(item => item.cnt)
                    }
                ]
            };
            setStats(state);
            setLoading(false);
        }
        fetchData()
            // make sure to catch any error
            .catch((err) => setErrorMessageLoad(err.message));
    }

    useEffect(loadStats, []);
    useEffect(() => {
        loadStats();
    }, []);
    if (errorMessageLoad) {
        return (
            <Alert severity="error">{errorMessageLoad}</Alert>)
    }
    if (loading) {
        return <SuspenseLoaderInline success={false}></SuspenseLoaderInline>;
    }

    return (
        <Chart style={{marginTop: 25}}
               options={stats.options}
               series={stats.series}
               type="bar"
               width="100%"
        />
    );
}
