import type {FC} from "react";
import { useEffect} from "react";
import * as React from "react";
import Chart from "react-apexcharts";
import {Alert, Card, CardContent, CardHeader, Grid, Paper} from "@mui/material";
import {SuspenseLoaderInline} from "../SuspenseLoader";
import type {ICountStats} from "@dbstats/shared/src/stats";
import type {ApexOptions} from "apexcharts";
import distinctColors from "distinct-colors";


type CountStatesChartProps = {
    title: string,
    api: () => Promise<Array< ICountStats >>,
}

export const CountStatsChart: FC<CountStatesChartProps> = ({title, api}) => {

    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState(null);
    const [errorMessageLoad, setErrorMessageLoad] = React.useState('');


    function loadStats() {

        const fetchData = async () => {
            setLoading(true);
            const data = await api();

            const state: {options: ApexOptions, series: ApexAxisChartSeries } = {
                options: {colors: distinctColors({count: 30}).map(c=>c.hex()),
                    legend: {
                        show: false,
                    },
                    title: {text: title},
                    chart: {
                    },
                    plotOptions: {
                        bar: {
                            distributed: true,
                            borderRadius: 4,
                            borderRadiusApplication: 'end',
                            horizontal: true,
                        }
                    },
                    xaxis: {
                        categories: data.map(item=>item.type)
                    }
                },
                series: [
                    {
                        name: "",
                        data: data.map(item=>item.cnt)
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
    useEffect( () => {
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
            <Chart
                options={stats.options}
                series={stats.series}
                type="bar"
                width="100%"
            />
    );
}
