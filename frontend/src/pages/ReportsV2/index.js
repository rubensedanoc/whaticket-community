import { format } from "date-fns";
import React, { useContext, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import MainHeader from "../../components/MainHeader";
import ReportsCountrySelect from "../../components/ReportsCountrySelect";
import ReportsQueueSelect from "../../components/ReportsQueueSelect";
import ReportsTicketTypeSelect from "../../components/ReportsTicketTypeSelect";
import ReportsWhatsappSelect from "../../components/ReportsWhatsappSelect";
import TicketListModal from "../../components/TicketListModal";
import Title from "../../components/Title";

import Typography from "@material-ui/core/Typography";
import * as XLSX from "xlsx";

import { useEffect } from "react";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import Chart from "./Chart";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 250,
  },
  customFixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    // height: 120,
  },
  customFixedHeightPaperLg: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
  },
}));

function esFechaValida(fechaStr) {
  const fecha = new Date(fechaStr);
  return fecha instanceof Date && !isNaN(fecha.getTime());
}

function segundosAHorasMinutos(segundos) {
  const horas = Math.floor(segundos / 3600);
  segundos %= 3600;
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = Math.floor(segundos % 60);

  return `${horas}h ${minutos}m ${segundosRestantes}s`;
}

const Reports = () => {
  const classes = useStyles();

  const [
    loadingReportHistoryWithDateRange,
    setLoadingReportHistoryWithDateRange,
  ] = useState(true);
  const [loadingReportHistory, setLoadingReportHistory] = useState(true);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);

  const [countries, setCountries] = useState([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState([]);

  const [selectedTypes, setSelectedTypes] = useState([]);

  const [createdTicketsData, setCreatedTicketsData] = useState(null);
  const [createdTicketsCount, setCreatedTicketsCount] = useState(null);
  const [createdTicketsChartData, setCreatedTicketsChartData] = useState(null);

  const [
    createdTicketsClosedInTheRangeTimeChartData,
    setCreatedTicketsClosedInTheRangeTimeChartData,
  ] = useState(null);
  const [
    createdTicketsClosedInTheRangeTimeData,
    setCreatedTicketsClosedInTheRangeTimeData,
  ] = useState(null);

  const [tprData, setTprData] = useState(null);
  const [tprPromedio, setTprPromedio] = useState(null);

  const [tdrData, setTdrData] = useState(null);
  const [tdrPromedio, setTdrPromedio] = useState(null);
  const [
    createdTicketsClosedInTheRangeTimeCount,
    setCreatedTicketsClosedInTheRangeTimeCount,
  ] = useState(null);

  const [responseTimesData, setResponseTimesData] = useState(null);
  const [responseTimes, setResponseTimes] = useState(null);
  const [closeQuintilesTimes, setCloseQuintilesTimes] = useState(null);
  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTickets, setTicketListModalTickets] = useState([]);
  const [reportsByUser, setReportsByUser] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [loadingReportToExcel, setLoadingReportToExcel] = useState(false);
  const [loadingReportToExcelIA, setLoadingReportToExcelIA] = useState(false);
  const [loadingReportOpenChats, setLoadingReportOpenChats] = useState(false);
  const [
    ticketsIdsWithResposneThatAreGroups,
    setTicketsIdsWithResposneThatAreGroups,
  ] = useState([]);
  const [
    ticketsIdsWithResposneThatAreIndividuals,
    setTicketsIdsWithResposneThatAreIndividuals,
  ] = useState([]);
  const [
    ticketsIdsWithNoResponseThatAreGroups,
    setTicketsIdsWithNoResponseThatAreGroups,
  ] = useState([]);
  const [
    ticketsIdsWithNoResponseThatAreIndividuals,
    setTicketsIdsWithNoResponseThatAreIndividuals,
  ] = useState([]);

  const [fromDate, setFromDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 00:00:00"
  );
  const { whatsApps } = useContext(WhatsAppsContext);
  const [toDate, setToDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 23:59:59"
  );

  useEffect(() => {
    console.log("whatsApps", whatsApps);
  }, [whatsApps]);

  useEffect(() => {
    if (localStorage.getItem("ReportsWhatsappSelect")) {
      setSelectedWhatsappIds(
        JSON.parse(localStorage.getItem("ReportsWhatsappSelect"))
      );
    }
    if (localStorage.getItem("ReportsCountrySelect")) {
      setSelectedCountryIds(
        JSON.parse(localStorage.getItem("ReportsCountrySelect"))
      );
    }
    if (localStorage.getItem("ReportsTicketTypeSelect")) {
      setSelectedTypes(
        JSON.parse(localStorage.getItem("ReportsTicketTypeSelect"))
      );
    }
    if (localStorage.getItem("ReportsQueueSelect")) {
      setSelectedQueueIds(
        JSON.parse(localStorage.getItem("ReportsQueueSelect"))
      );
    }

    getReportHistory({
      selectedWhatsappIds:
        JSON.parse(localStorage.getItem("ReportsWhatsappSelect")) ||
        selectedWhatsappIds,
      selectedCountryIds:
        JSON.parse(localStorage.getItem("ReportsCountrySelect")) ||
        selectedCountryIds,
      selectedTypes:
        JSON.parse(localStorage.getItem("ReportsTicketTypeSelect")) ||
        selectedTypes,
      selectedQueueIds:
        JSON.parse(localStorage.getItem("ReportsQueueSelect")) ||
        selectedQueueIds,
    });
    getReportHistoryWithDateRange({
      fromDate,
      toDate,
      selectedWhatsappIds:
        JSON.parse(localStorage.getItem("ReportsWhatsappSelect")) ||
        selectedWhatsappIds,
      selectedCountryIds:
        JSON.parse(localStorage.getItem("ReportsCountrySelect")) ||
        selectedCountryIds,
      selectedQueueIds:
        JSON.parse(localStorage.getItem("ReportsQueueSelect")) ||
        selectedQueueIds,
    });

    (async () => {
      try {
        const { data } = await api.get(`/countries`);
        if (data?.countries?.length > 0) {
          setCountries(data.countries);
        }

        const { data: queueData } = await api.get("/queue");

        if (queueData.length > 0) {
          setQueues(queueData);
        }

        console.log({ queueData });
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const getReportHistoryWithDateRange = async ({
    fromDate,
    toDate,
    selectedWhatsappIds,
    selectedCountryIds,
    selectedQueueIds,
  }) => {
    try {
      setLoadingReportHistoryWithDateRange(true);

      const { data: reportHistoryWithDateRange } = await api.get(
        "/reportHistoryWithDateRange",
        {
          params: {
            fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
            selectedCountryIds: JSON.stringify(selectedCountryIds),
            selectedQueueIds: JSON.stringify(selectedQueueIds),
          },
        }
      );

      console.log("reportHistoryWithDateRange: ", reportHistoryWithDateRange);

      if (reportHistoryWithDateRange) {
        setTprPromedio(reportHistoryWithDateRange.avgTimeSecoundsFirstResponse);
        setTdrPromedio(reportHistoryWithDateRange.avgTimeSecounsSolution);
        setCreatedTicketsCount(
          reportHistoryWithDateRange.ticketsCreated?.count
        );
        setCreatedTicketsClosedInTheRangeTimeCount(
          reportHistoryWithDateRange.ticketsClosed?.count
        );

        setCreatedTicketsChartData(
          reportHistoryWithDateRange.datesCreatedTickets
        );

        setCreatedTicketsClosedInTheRangeTimeChartData(
          reportHistoryWithDateRange.datesCloseTickets
        );

        setCloseQuintilesTimes(reportHistoryWithDateRange.timesQuintalResponse);
      }

      const { data: reportToUsers } = await api.get("/reportToUsers", {
        params: {
          fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
          selectedCountryIds: JSON.stringify(selectedCountryIds),
          selectedQueueIds: JSON.stringify(selectedQueueIds),
        },
      });

      console.log("reportToUsers: ", reportToUsers);

      if (reportToUsers) {
        setReportsByUser(Object.values(reportToUsers.usersListAll));
      }

      setLoadingReportHistoryWithDateRange(false);
    } catch (error) {
      console.log(error);
      toastError(error);
      setLoadingReportHistoryWithDateRange(false);
    }
  };

  const getReportToExcel = async ({
    fromDate,
    toDate,
    selectedWhatsappIds,
    selectedQueueIds,
  }) => {
    try {
      setLoadingReportToExcel(true);
      const { data: reportToExcel } = await api.get("/reportToExcel", {
        params: {
          fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
          selectedQueueIds: JSON.stringify(selectedQueueIds),
        },
      });

      if (reportToExcel) {
        console.log("reportToExcel: ", reportToExcel);

        const dataToExport = reportToExcel.ticketListFinal.map((row) => {
          let extraData = null;

          if (row.microserviceData) {
            row.microserviceData.forEach((dynamicRow, index) => {
              // Para evitar conflictos, añadimos el índice como prefijo de los campos dinámicos
              const dynamicFields = Object.keys(dynamicRow).reduce(
                (acc, key) => {
                  acc[`${key.toUpperCase()}_${index + 1}`] = dynamicRow[key];
                  return acc;
                },
                {}
              );

              extraData = { ...extraData, ...dynamicFields };
            });
          }

          return {
            "N. DE TICKET": row.tid,
            CREACIÓN_FECHA: format(new Date(row.tcreatedAt), "dd-MM-yyyy"),
            CREACIÓN_HORA: format(new Date(row.tcreatedAt), "HH:mm"),
            CONTACTO: row.ctname,
            NUMERO: row.tisGroup ? "NO APLICA" : row.ctnumber,
            PAIS: row.ctcname,
            CONEXIÓN: row.wname,
            "ES GRUPO?": row.tisGroup ? "SI" : "NO",
            DEPARTAMENTO: row.queuename,
            CATEGORIA: row.tcategoryname,
            ASIGNADO: row.tisGroup ? "NO APLICA" : row.uname,
            ESTADO: row.tstatus,
            "ESPERANDO?": row.waiting ? "SI" : "NO",
            "T. PRIMERA RESPUESTA": row.firstResponse,
            "T. DE RESOLUCIÓN": row.resolution,
            "T. DE RESPEUSTA PROM.": row.avgResponse,
            "T. PRIMERA RESPUESTA (MIN)": row.firstResponse ? row.firstResponse * 60 : 0,
            "T. DE RESOLUCIÓN (MIN)": row.resolution ? row.resolution * 60 : 0,
            "T. DE RESPEUSTA PROM. (MIN)": row.avgResponse ? row.avgResponse * 60 : 0,
            QUINTAL: row.quintalHours,
            "PRIMERA RESPUESTA": row.firstResponseMessage,
            ...extraData,
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${"WHATREST"}.xlsx`);
      }

      setLoadingReportToExcel(false);
    } catch (error) {
      console.log(error);
      toastError(error);
    }
  };
  const reportToExcelForIA = async ({ fromDate, toDate, selectedQueueIds }) => {
    try {
      setLoadingReportToExcelIA(true);
      const { data: reportToExcelForIA } = await api.get(
        "/reportToExcelForIA",
        {
          params: {
            fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            selectedQueueIds: JSON.stringify(selectedQueueIds),
          },
        }
      );

      if (reportToExcelForIA) {
        console.log("reportToExcelForIA: ", reportToExcelForIA.ticketListFinal);

        let dataToExport = reportToExcelForIA.ticketListFinal.map((row) => {
          if (!row.IATrainingData) {
            return null;
          }

          if (
            row.IATrainingData?.map((data) => data.mbody).join(" ").length > 800
          ) {
            console.log("row.IATrainingData: ", row.IATrainingData);
          }

          return {
            INCIDENCIA:
              row.IATrainingData &&
              row.IATrainingData.map((data) => data.mbody).join(" "),
            CATEGORIA: row.tcategoryname,
            TID: row.tid,
          };
        });

        dataToExport = dataToExport.filter((row) => row);

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${"WHATREST-reportToExcelForIA"}.xlsx`);
      }

      setLoadingReportToExcelIA(false);
    } catch (error) {
      setLoadingReportToExcelIA(false);
      console.log(error);
      toastError(error);
    }
  };

  const reportOpenChats = async ({ selectedQueueIds }) => {
    try {
      setLoadingReportOpenChats(true);
      const { data: reportOpenChats } = await api.get("/reportOpenChats", {
        params: {
          selectedQueueIds: JSON.stringify(selectedQueueIds),
        },
      });

      if (reportOpenChats) {
        console.log("reportOpenChats: ", reportOpenChats.ticketListFinal);

        let dataToExport = reportOpenChats.ticketListFinal.map((row) => {
          return {
            TICKET_ID: row.tid,
            CONTACTO: row.ctname,
            TELEFONO: row.ctnumber,
            WHATSAPP: row.wname,
            DEPARTAMENTO: row.queuename || "Sin departamento",
            USUARIO: row.uname || "Sin asignar",
            ESTADO: row.tstatus === "open" ? "Abierto" : "En proceso",
            FECHA_CREACION: format(
              new Date(row.tcreatedAt),
              "dd/MM/yyyy HH:mm"
            ),
            ULTIMA_ACTIVIDAD: format(
              new Date(row.tupdatedAt),
              "dd/MM/yyyy HH:mm"
            ),
            CANT_MENSAJES: row.messageCount,
            CONVERSACION: row.messages,
          };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        
        // Ajustar ancho de columnas
        const columnWidths = [
          { wch: 10 },  // TICKET_ID
          { wch: 25 },  // CONTACTO
          { wch: 15 },  // TELEFONO
          { wch: 20 },  // WHATSAPP
          { wch: 20 },  // DEPARTAMENTO
          { wch: 20 },  // USUARIO
          { wch: 12 },  // ESTADO
          { wch: 18 },  // FECHA_CREACION
          { wch: 18 },  // ULTIMA_ACTIVIDAD
          { wch: 12 },  // CANT_MENSAJES
          { wch: 100 }, // CONVERSACION (más ancho)
        ];
        worksheet["!cols"] = columnWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Chats Abiertos");
        XLSX.writeFile(
          workbook,
          `WHATREST-chats-abiertos-${format(new Date(), "yyyy-MM-dd")}.xlsx`
        );
      }

      setLoadingReportOpenChats(false);
    } catch (error) {
      setLoadingReportOpenChats(false);
      console.log(error);
      toastError(error);
    }
  };

  const getReportHistory = async ({
    selectedWhatsappIds,
    selectedCountryIds,
    selectedTypes,
    selectedQueueIds,
  }) => {
    try {
      setLoadingReportHistory(true);

      const { data: reportHistory } = await api.get("/reportHistory", {
        params: {
          selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
          selectedCountryIds: JSON.stringify(selectedCountryIds),
          selectedTypes: JSON.stringify(selectedTypes),
          selectedQueueIds: JSON.stringify(selectedQueueIds),
        },
      });

      console.log("reportHistory: ", reportHistory);

      if (reportHistory) {
        setResponseTimesData(
          reportHistory.ticketsCount.withOutResponse.total.ticketIds
        );
        setResponseTimes(reportHistory.timesQuintalWaitingResponse);

        setTicketsIdsWithResposneThatAreGroups(
          reportHistory.ticketsCount.withResponse.grupal.ticketIds
        );

        setTicketsIdsWithResposneThatAreIndividuals(
          reportHistory.ticketsCount.withResponse.individual.ticketIds
        );

        setTicketsIdsWithNoResponseThatAreGroups(
          reportHistory.ticketsCount.withOutResponse.grupal.ticketIds
        );

        setTicketsIdsWithNoResponseThatAreIndividuals(
          reportHistory.ticketsCount.withOutResponse.individual.ticketIds
        );
      }

      setLoadingReportHistory(false);
    } catch (error) {
      console.log(error);
      toastError(error);
    }
  };

  return (
    <div>
      <Container maxWidth="lg" className={classes.container}>
        <MainHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex" }}>
              <Title>Reportes</Title>
              <div
                style={{
                  marginLeft: "2.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                {/* <UsersSelect
                selectedUserIds={selectedUserIds}
                onChange={(value) => {
                  setSelectedUserIds(value);
                }}
              /> */}
                <ReportsWhatsappSelect
                  style={{ marginLeft: 6 }}
                  selectedWhatsappIds={selectedWhatsappIds || []}
                  userWhatsapps={whatsApps || []}
                  onChange={(values) => setSelectedWhatsappIds(values)}
                />

                <ReportsCountrySelect
                  style={{ marginLeft: 6 }}
                  selectedCountryIds={selectedCountryIds || []}
                  countries={countries || []}
                  onChange={(values) => {
                    setSelectedCountryIds(values);
                  }}
                />

                <ReportsTicketTypeSelect
                  style={{ marginLeft: 6 }}
                  selectedTypes={selectedTypes || []}
                  types={[
                    { id: "individual", name: "Individual" },
                    { id: "group", name: "Grupo" },
                  ]}
                  onChange={(values) => {
                    setSelectedTypes(values);
                  }}
                />

                <ReportsQueueSelect
                  style={{ marginLeft: 6 }}
                  selectedQueueIds={selectedQueueIds || []}
                  userQueues={queues || []}
                  onChange={(values) => setSelectedQueueIds(values)}
                />

                {/* {loading && <CircularProgress color="primary" size={25} />} */}
              </div>
            </div>
            <ButtonWithSpinner
              variant="contained"
              color="primary"
              onClick={() => {
                getReportHistory({
                  selectedWhatsappIds,
                  selectedCountryIds,
                  selectedTypes,
                  selectedQueueIds,
                });
              }}
              loading={loadingReportHistory}
            >
              Actualizar
            </ButtonWithSpinner>
          </div>
        </MainHeader>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Typography
                component="h3"
                variant="h6"
                color="primary"
                paragraph
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>Quintiles de espera actual</span>
                <span style={{ color: "black" }}>
                  Tickets Totales:{" "}
                  {responseTimesData ? responseTimesData.length : 0}
                </span>
              </Typography>
              <div style={{ flexGrow: 1 }}>
                <Grid container spacing={3} style={{ fontSize: 18 }}>
                  {responseTimes ? (
                    <>
                      <Grid item xs={4}>
                        {responseTimes.slice(0, 5).map((range) => (
                          <div key={range.label}>
                            <span>{range.label}</span>
                            {": "}
                            <IconButton
                              size="small"
                              color="primary"
                              style={{ fontWeight: "bold" }}
                              onClick={() => {
                                setTicketListModalOpen(true);
                                setTicketListModalTickets(range.ticketIds);
                                setTicketListModalTitle(range.label);
                              }}
                            >
                              {range.count}{" "}
                              {range.count > 0 && (
                                <span
                                  style={{
                                    color: "black",
                                    fontSize: "12px",
                                    display: "inline-block",
                                    marginLeft: 5,
                                  }}
                                >
                                  (
                                  {Math.round(
                                    (range.count * 100) /
                                      responseTimes
                                        .slice(0, 5)
                                        .reduce(
                                          (acc, range) => acc + range.count,
                                          0
                                        )
                                  )}
                                  %)
                                </span>
                              )}
                            </IconButton>
                          </div>
                        ))}

                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (responseTimes
                              .slice(0, 5)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              responseTimesData.length
                          )}
                          %
                        </div>
                      </Grid>
                      <Grid item xs={4}>
                        {responseTimes.slice(5, 10).map((range, index) => (
                          <div key={range.label}>
                            <span>{range.label}</span>
                            {": "}
                            <IconButton
                              size="small"
                              color="primary"
                              style={{ fontWeight: "bold" }}
                              onClick={() => {
                                setTicketListModalOpen(true);
                                setTicketListModalTickets(range.ticketIds);
                                setTicketListModalTitle(range.label);
                              }}
                            >
                              {range.count}{" "}
                              {index !== 0 && range.count > 0 && (
                                <span
                                  style={{
                                    color: "black",
                                    fontSize: "12px",
                                    display: "inline-block",
                                    marginLeft: 5,
                                  }}
                                >
                                  (
                                  {Math.round(
                                    (range.count * 100) /
                                      responseTimes
                                        .slice(6, 10)
                                        .reduce(
                                          (acc, range) => acc + range.count,
                                          0
                                        )
                                  )}
                                  %)
                                </span>
                              )}
                            </IconButton>
                          </div>
                        ))}
                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (responseTimes
                              .slice(6, 10)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              responseTimesData.length
                          )}
                          %
                        </div>
                      </Grid>
                      <Grid item xs={4}>
                        {responseTimes.slice(10, 15).map((range, index) => (
                          <div key={range.label}>
                            <span>{range.label}</span>
                            {": "}
                            <IconButton
                              size="small"
                              color="primary"
                              style={{ fontWeight: "bold" }}
                              onClick={() => {
                                setTicketListModalOpen(true);
                                setTicketListModalTickets(range.ticketIds);
                                setTicketListModalTitle(range.label);
                              }}
                            >
                              {range.count}
                              {index !== 0 && range.count > 0 && (
                                <span
                                  style={{
                                    color: "black",
                                    fontSize: "12px",
                                    display: "inline-block",
                                    marginLeft: 5,
                                  }}
                                >
                                  (
                                  {Math.round(
                                    (range.count * 100) /
                                      responseTimes
                                        .slice(11, 15)
                                        .reduce(
                                          (acc, range) => acc + range.count,
                                          0
                                        )
                                  )}
                                  %)
                                </span>
                              )}
                            </IconButton>
                          </div>
                        ))}
                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (responseTimes
                              .slice(11, 15)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              responseTimesData.length
                          )}
                          %
                        </div>
                      </Grid>

                      <TicketListModal
                        modalOpen={ticketListModalOpen}
                        onClose={() => setTicketListModalOpen(false)}
                        title={ticketListModalTitle}
                        tickets={ticketListModalTickets}
                        newView={true}
                      />
                    </>
                  ) : null}
                </Grid>
              </div>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.customFixedHeightPaper}>
              <Typography
                component="h3"
                variant="h6"
                color="primary"
                paragraph
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>Distribución de tickets actual</span>
              </Typography>

              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell align="center"></TableCell>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Con respuesta
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Sin respuesta
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Individuales
                    </TableCell>
                    <TableCell align="center" style={{ fontSize: "18px" }}>
                      <div>
                        <div>
                          <IconButton
                            size="small"
                            color="primary"
                            style={{ fontWeight: "bold" }}
                            onClick={() => {
                              setTicketListModalOpen(true);
                              setTicketListModalTickets([
                                ...ticketsIdsWithResposneThatAreIndividuals,
                              ]);
                              setTicketListModalTitle(
                                "Individuales con respuesta"
                              );
                            }}
                          >
                            {ticketsIdsWithResposneThatAreIndividuals?.length}
                          </IconButton>

                          {ticketsIdsWithNoResponseThatAreIndividuals?.length +
                            ticketsIdsWithResposneThatAreIndividuals?.length >
                            0 && (
                            <span
                              style={{
                                color: "black",
                                fontSize: "12px",
                                display: "inline-block",
                                marginLeft: 5,
                              }}
                            >
                              (
                              {Math.round(
                                (ticketsIdsWithResposneThatAreIndividuals?.length *
                                  100) /
                                  (ticketsIdsWithNoResponseThatAreIndividuals?.length +
                                    ticketsIdsWithResposneThatAreIndividuals?.length)
                              )}
                              %)
                            </span>
                          )}
                        </div>
                        {ticketsIdsWithResposneThatAreGroups?.length +
                          ticketsIdsWithResposneThatAreIndividuals?.length >
                          0 && (
                          <span
                            style={{
                              color: "black",
                              fontSize: "12px",
                              display: "inline-block",
                              marginLeft: 5,
                            }}
                          >
                            (
                            {Math.round(
                              (ticketsIdsWithResposneThatAreIndividuals?.length *
                                100) /
                                (ticketsIdsWithResposneThatAreGroups?.length +
                                  ticketsIdsWithResposneThatAreIndividuals?.length)
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="center" style={{ fontSize: "18px" }}>
                      <div>
                        <div>
                          <IconButton
                            size="small"
                            color="primary"
                            style={{ fontWeight: "bold" }}
                            onClick={() => {
                              setTicketListModalOpen(true);
                              setTicketListModalTickets([
                                ...ticketsIdsWithNoResponseThatAreIndividuals,
                              ]);
                              setTicketListModalTitle(
                                "Individuales sin respuesta"
                              );
                            }}
                          >
                            {ticketsIdsWithNoResponseThatAreIndividuals?.length}
                          </IconButton>

                          {ticketsIdsWithNoResponseThatAreIndividuals?.length +
                            ticketsIdsWithResposneThatAreIndividuals?.length >
                            0 && (
                            <span
                              style={{
                                color: "black",
                                fontSize: "12px",
                                display: "inline-block",
                                marginLeft: 5,
                              }}
                            >
                              (
                              {Math.round(
                                (ticketsIdsWithNoResponseThatAreIndividuals?.length *
                                  100) /
                                  (ticketsIdsWithNoResponseThatAreIndividuals?.length +
                                    ticketsIdsWithResposneThatAreIndividuals?.length)
                              )}
                              %)
                            </span>
                          )}
                        </div>

                        {ticketsIdsWithNoResponseThatAreGroups?.length +
                          ticketsIdsWithNoResponseThatAreIndividuals?.length >
                          0 && (
                          <span
                            style={{
                              color: "black",
                              fontSize: "12px",
                              display: "inline-block",
                              marginLeft: 5,
                            }}
                          >
                            (
                            {Math.round(
                              (ticketsIdsWithNoResponseThatAreIndividuals?.length *
                                100) /
                                (ticketsIdsWithNoResponseThatAreGroups?.length +
                                  ticketsIdsWithNoResponseThatAreIndividuals?.length)
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontSize: "18px", color: "#2576d2" }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        style={{ fontWeight: "bold" }}
                        onClick={() => {
                          setTicketListModalOpen(true);
                          setTicketListModalTickets([
                            ...ticketsIdsWithNoResponseThatAreIndividuals,
                          ]);
                          setTicketListModalTitle("Todos los individuales");
                        }}
                      >
                        {ticketsIdsWithNoResponseThatAreIndividuals?.length +
                          ticketsIdsWithResposneThatAreIndividuals?.length}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Grupos
                    </TableCell>
                    <TableCell align="center" style={{ fontSize: "18px" }}>
                      <div>
                        <div>
                          <IconButton
                            size="small"
                            color="primary"
                            style={{ fontWeight: "bold" }}
                            onClick={() => {
                              setTicketListModalOpen(true);
                              setTicketListModalTickets(
                                ticketsIdsWithResposneThatAreGroups
                              );
                              setTicketListModalTitle("Grupos con respuesta");
                            }}
                          >
                            {ticketsIdsWithResposneThatAreGroups?.length}
                          </IconButton>

                          {ticketsIdsWithNoResponseThatAreGroups?.length +
                            ticketsIdsWithResposneThatAreGroups?.length >
                            0 && (
                            <span
                              style={{
                                color: "black",
                                fontSize: "12px",
                                display: "inline-block",
                                marginLeft: 5,
                              }}
                            >
                              (
                              {Math.round(
                                (ticketsIdsWithResposneThatAreGroups?.length *
                                  100) /
                                  (ticketsIdsWithNoResponseThatAreGroups?.length +
                                    ticketsIdsWithResposneThatAreGroups?.length)
                              )}
                              %)
                            </span>
                          )}
                        </div>
                        {ticketsIdsWithResposneThatAreGroups?.length +
                          ticketsIdsWithResposneThatAreIndividuals?.length >
                          0 && (
                          <span
                            style={{
                              color: "black",
                              fontSize: "12px",
                              display: "inline-block",
                              marginLeft: 5,
                            }}
                          >
                            (
                            {Math.round(
                              (ticketsIdsWithResposneThatAreGroups?.length *
                                100) /
                                (ticketsIdsWithResposneThatAreGroups?.length +
                                  ticketsIdsWithResposneThatAreIndividuals?.length)
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="center" style={{ fontSize: "18px" }}>
                      <div>
                        <div>
                          <IconButton
                            size="small"
                            color="primary"
                            style={{ fontWeight: "bold" }}
                            onClick={() => {
                              setTicketListModalOpen(true);
                              setTicketListModalTickets(
                                ticketsIdsWithNoResponseThatAreGroups
                              );
                              setTicketListModalTitle("Grupos sin respuesta");
                            }}
                          >
                            {ticketsIdsWithNoResponseThatAreGroups?.length}
                          </IconButton>

                          {ticketsIdsWithResposneThatAreGroups?.length +
                            ticketsIdsWithNoResponseThatAreGroups?.length >
                            0 && (
                            <span
                              style={{
                                color: "black",
                                fontSize: "12px",
                                display: "inline-block",
                                marginLeft: 5,
                              }}
                            >
                              (
                              {Math.round(
                                (ticketsIdsWithNoResponseThatAreGroups?.length *
                                  100) /
                                  (ticketsIdsWithResposneThatAreGroups?.length +
                                    ticketsIdsWithNoResponseThatAreGroups?.length)
                              )}
                              %)
                            </span>
                          )}
                        </div>

                        {ticketsIdsWithNoResponseThatAreGroups?.length +
                          ticketsIdsWithNoResponseThatAreIndividuals?.length >
                          0 && (
                          <span
                            style={{
                              color: "black",
                              fontSize: "12px",
                              display: "inline-block",
                              marginLeft: 5,
                            }}
                          >
                            (
                            {Math.round(
                              (ticketsIdsWithNoResponseThatAreGroups?.length *
                                100) /
                                (ticketsIdsWithNoResponseThatAreGroups?.length +
                                  ticketsIdsWithNoResponseThatAreIndividuals?.length)
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontSize: "18px", color: "#2576d2" }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        style={{ fontWeight: "bold" }}
                        onClick={() => {
                          setTicketListModalOpen(true);
                          setTicketListModalTickets([
                            ...ticketsIdsWithNoResponseThatAreGroups,
                            ...ticketsIdsWithResposneThatAreGroups,
                          ]);
                          setTicketListModalTitle("Todos los grupos");
                        }}
                      >
                        {ticketsIdsWithNoResponseThatAreGroups?.length +
                          ticketsIdsWithResposneThatAreGroups?.length}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      align="center"
                      style={{ fontWeight: "bold", fontSize: "18px" }}
                    >
                      Total
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontSize: "18px", color: "#2576d2" }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        style={{ fontWeight: "bold" }}
                        onClick={() => {
                          setTicketListModalOpen(true);
                          setTicketListModalTickets([
                            ...ticketsIdsWithResposneThatAreGroups,
                            ...ticketsIdsWithResposneThatAreIndividuals,
                          ]);
                          setTicketListModalTitle(
                            "Todos los tickets con respuesta"
                          );
                        }}
                      >
                        {ticketsIdsWithResposneThatAreGroups?.length +
                          ticketsIdsWithResposneThatAreIndividuals?.length}
                      </IconButton>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontSize: "18px", color: "#2576d2" }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        style={{ fontWeight: "bold" }}
                        onClick={() => {
                          setTicketListModalOpen(true);
                          setTicketListModalTickets([
                            ...ticketsIdsWithNoResponseThatAreGroups,
                            ...ticketsIdsWithNoResponseThatAreIndividuals,
                          ]);
                          setTicketListModalTitle(
                            "Todos los tickets sin respuesta"
                          );
                        }}
                      >
                        {ticketsIdsWithNoResponseThatAreGroups?.length +
                          ticketsIdsWithNoResponseThatAreIndividuals?.length}
                      </IconButton>
                    </TableCell>
                    <TableCell
                      align="center"
                      style={{ fontSize: "18px", color: "#2576d2" }}
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        style={{ fontWeight: "bold" }}
                        onClick={() => {
                          setTicketListModalOpen(true);
                          setTicketListModalTickets([
                            ...ticketsIdsWithNoResponseThatAreGroups,
                            ...ticketsIdsWithNoResponseThatAreIndividuals,
                            ...ticketsIdsWithResposneThatAreGroups,
                            ...ticketsIdsWithResposneThatAreIndividuals,
                          ]);
                          setTicketListModalTitle("Todos los tickets");
                        }}
                      >
                        {ticketsIdsWithNoResponseThatAreGroups?.length +
                          ticketsIdsWithNoResponseThatAreIndividuals?.length +
                          ticketsIdsWithResposneThatAreGroups?.length +
                          ticketsIdsWithResposneThatAreIndividuals?.length}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {/* {loading && <TableRowSkeleton columns={4} />} */}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <MainHeader>
              <div
                style={{
                  display: "flex",
                  marginTop: "1rem",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <TextField
                      id="date"
                      label="Desde"
                      type="datetime-local"
                      variant="outlined"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className={classes.textField}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                    <TextField
                      id="date"
                      label="Hasta"
                      type="datetime-local"
                      variant="outlined"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className={classes.textField}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                    <div>
                      {/* <UsersSelect
                selectedUserIds={selectedUserIds}
                onChange={(value) => {
                  setSelectedUserIds(value);
                }}
              /> */}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                  }}
                >
                  <ButtonWithSpinner
                    variant="contained"
                    style={{ color: "white", backgroundColor: "#2de241" }}
                    onClick={() =>
                      getReportToExcel({
                        fromDate,
                        toDate,
                        selectedWhatsappIds,
                        selectedQueueIds,
                      })
                    }
                    loading={loadingReportToExcel}
                  >
                    Exportar a Excel
                  </ButtonWithSpinner>
                  <ButtonWithSpinner
                    variant="contained"
                    style={{ color: "white", backgroundColor: "#2de241" }}
                    onClick={() =>
                      reportToExcelForIA({
                        fromDate,
                        toDate,
                        selectedQueueIds,
                      })
                    }
                    loading={loadingReportToExcelIA}
                  >
                    IA Excel (by departamento)
                  </ButtonWithSpinner>
                  <ButtonWithSpinner
                    variant="contained"
                    style={{ color: "white", backgroundColor: "#ff9800" }}
                    onClick={() =>
                      reportOpenChats({
                        selectedQueueIds,
                      })
                    }
                    loading={loadingReportOpenChats}
                  >
                    Reporte de chats abiertos
                  </ButtonWithSpinner>
                  <ButtonWithSpinner
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      getReportHistoryWithDateRange({
                        fromDate,
                        toDate,
                        selectedWhatsappIds,
                        selectedCountryIds,
                        selectedQueueIds,
                      });
                    }}
                    loading={loadingReportHistoryWithDateRange}
                  >
                    Actualizar
                  </ButtonWithSpinner>
                </div>
              </div>
            </MainHeader>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.customFixedHeightPaper}>
              <Typography
                component="h3"
                variant="h6"
                color="primary"
                paragraph
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>Metricas por usuario</span>
              </Typography>

              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      Usuario
                    </TableCell>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      T. tomados
                    </TableCell>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      T. abiertos
                    </TableCell>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      T. abiertos esperando
                    </TableCell>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      Tiempo prom. esperando
                    </TableCell>
                    <TableCell style={{ fontWeight: "bold", fontSize: "18px" }}>
                      T. cerrados
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportsByUser.length > 0 ? (
                    reportsByUser.map((report) => (
                      <TableRow key={report.name}>
                        <TableCell>{report.name}</TableCell>
                        <TableCell>{report.ticketCount}</TableCell>
                        <TableCell>{report.ticketOpenCount}</TableCell>
                        <TableCell>{report.timeWaitingCount}</TableCell>
                        <TableCell>
                          {report.timeWaitingSecounds / report.timeWaitingCount
                            ? segundosAHorasMinutos(
                                report.timeWaitingSecounds /
                                  report.timeWaitingCount
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>{report.ticketClosedCount}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4}>Sin hay datos</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Typography
                component="h3"
                variant="h6"
                color="primary"
                paragraph
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>Quintiles de resolución</span>
                <span style={{ color: "black" }}>
                  Tickets resueltos:{" "}
                  {createdTicketsClosedInTheRangeTimeCount &&
                    createdTicketsClosedInTheRangeTimeCount}
                </span>
              </Typography>
              <div style={{ flexGrow: 1 }}>
                <Grid container spacing={3} style={{ fontSize: 18 }}>
                  {closeQuintilesTimes ? (
                    <>
                      <Grid item xs={4}>
                        {closeQuintilesTimes.slice(0, 5).map((range) => (
                          <div key={range.label}>
                            <span>{range.label}</span>
                            {": "}
                            <IconButton
                              size="small"
                              color="primary"
                              style={{ fontWeight: "bold" }}
                              onClick={() => {
                                setTicketListModalOpen(true);
                                setTicketListModalTickets(range.ticketIds);
                                setTicketListModalTitle(range.label);
                              }}
                            >
                              {range.count}{" "}
                              {range.count > 0 && (
                                <span
                                  style={{
                                    color: "black",
                                    fontSize: "12px",
                                    display: "inline-block",
                                    marginLeft: 5,
                                  }}
                                >
                                  (
                                  {Math.round(
                                    (range.count * 100) /
                                      closeQuintilesTimes
                                        .slice(0, 5)
                                        .reduce(
                                          (acc, range) => acc + range.count,
                                          0
                                        )
                                  )}
                                  %)
                                </span>
                              )}
                            </IconButton>
                          </div>
                        ))}

                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (closeQuintilesTimes
                              .slice(0, 5)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              createdTicketsClosedInTheRangeTimeCount
                          ) || "-"}
                          %
                        </div>
                      </Grid>
                      <Grid item xs={4}>
                        {closeQuintilesTimes
                          .slice(5, 10)
                          .map((range, index) => (
                            <div key={range.label}>
                              <span>{range.label}</span>
                              {": "}
                              <IconButton
                                size="small"
                                color="primary"
                                style={{ fontWeight: "bold" }}
                                onClick={() => {
                                  setTicketListModalOpen(true);
                                  setTicketListModalTickets(range.ticketIds);
                                  setTicketListModalTitle(range.label);
                                }}
                              >
                                {range.count}{" "}
                                {index !== 0 && range.count > 0 && (
                                  <span
                                    style={{
                                      color: "black",
                                      fontSize: "12px",
                                      display: "inline-block",
                                      marginLeft: 5,
                                    }}
                                  >
                                    (
                                    {Math.round(
                                      (range.count * 100) /
                                        closeQuintilesTimes
                                          .slice(6, 10)
                                          .reduce(
                                            (acc, range) => acc + range.count,
                                            0
                                          )
                                    )}
                                    %)
                                  </span>
                                )}
                              </IconButton>
                            </div>
                          ))}
                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (closeQuintilesTimes
                              .slice(6, 10)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              createdTicketsClosedInTheRangeTimeCount
                          ) || "-"}
                          %
                        </div>
                      </Grid>
                      <Grid item xs={4}>
                        {closeQuintilesTimes
                          .slice(10, 15)
                          .map((range, index) => (
                            <div key={range.label}>
                              <span>{range.label}</span>
                              {": "}
                              <IconButton
                                size="small"
                                color="primary"
                                style={{ fontWeight: "bold" }}
                                onClick={() => {
                                  setTicketListModalOpen(true);
                                  setTicketListModalTickets(range.ticketIds);
                                  setTicketListModalTitle(range.label);
                                }}
                              >
                                {range.count}
                                {index !== 0 && range.count > 0 && (
                                  <span
                                    style={{
                                      color: "black",
                                      fontSize: "12px",
                                      display: "inline-block",
                                      marginLeft: 5,
                                    }}
                                  >
                                    (
                                    {Math.round(
                                      (range.count * 100) /
                                        closeQuintilesTimes
                                          .slice(11, 15)
                                          .reduce(
                                            (acc, range) => acc + range.count,
                                            0
                                          )
                                    )}
                                    %)
                                  </span>
                                )}
                              </IconButton>
                            </div>
                          ))}
                        <div style={{ fontWeight: "bold", marginTop: 5 }}>
                          Porcentaje:{" "}
                          {Math.round(
                            (closeQuintilesTimes
                              .slice(11, 15)
                              .reduce((acc, range) => acc + range.count, 0) *
                              100) /
                              createdTicketsClosedInTheRangeTimeCount
                          ) || "-"}
                          %
                        </div>
                      </Grid>

                      <TicketListModal
                        modalOpen={ticketListModalOpen}
                        onClose={() => setTicketListModalOpen(false)}
                        title={ticketListModalTitle}
                        tickets={ticketListModalTickets}
                        newView={true}
                      />
                    </>
                  ) : null}
                </Grid>
              </div>
            </Paper>
          </Grid>

          <Grid item xs={3}>
            <Paper
              className={classes.customFixedHeightPaper}
              style={{ overflow: "hidden" }}
            >
              <Typography component="h3" variant="h6" color="primary" paragraph>
                Tickets creados
              </Typography>
              <Grid item>
                <Typography component="h1" variant="h4">
                  {createdTicketsCount !== null && createdTicketsCount}
                </Typography>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper
              className={classes.customFixedHeightPaper}
              style={{ overflow: "hidden" }}
            >
              <Typography component="h3" variant="h6" color="primary" paragraph>
                T. primera respuesta prom
              </Typography>
              <Grid item>
                <Typography component="h1" variant="h4">
                  {tprPromedio ? segundosAHorasMinutos(tprPromedio) : "-"}
                </Typography>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper
              className={classes.customFixedHeightPaper}
              style={{ overflow: "hidden" }}
            >
              <Typography component="h3" variant="h6" color="primary" paragraph>
                Tickets resueltos
              </Typography>
              <Grid item>
                <Typography component="h1" variant="h4">
                  {createdTicketsClosedInTheRangeTimeCount}
                </Typography>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper
              className={classes.customFixedHeightPaper}
              style={{ overflow: "hidden" }}
            >
              <Typography component="h3" variant="h6" color="primary" paragraph>
                T. de resolución prom
              </Typography>
              <Grid item>
                <Typography component="h1" variant="h4">
                  {tdrPromedio ? segundosAHorasMinutos(tdrPromedio) : "-"}
                </Typography>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Chart
                title="Ticket creados en el tiempo"
                total={createdTicketsCount}
                chartData={createdTicketsChartData}
              />
            </Paper>
          </Grid>
          {/* <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Chart
                title={"Tiempo primera respuesta"}
                total={tprPromedio ? segundosAHorasMinutos(tprPromedio) : "-"}
              />
            </Paper>
          </Grid> */}
          <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Chart
                title="Tickets resueltos en el tiempo"
                total={createdTicketsClosedInTheRangeTimeCount}
                chartData={createdTicketsClosedInTheRangeTimeChartData}
              />
            </Paper>
          </Grid>

          {/* <Grid item xs={12}>
            <Paper className={classes.fixedHeightPaper}>
              <Chart
                title={"Tiempo de resolución"}
                total={tdrPromedio ? segundosAHorasMinutos(tdrPromedio) : "-"}
              />
            </Paper>
          </Grid> */}
        </Grid>
      </Container>
    </div>
  );
};

export default Reports;
