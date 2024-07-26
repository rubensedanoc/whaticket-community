import { format } from "date-fns";
import React, { useContext, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import MainHeader from "../../components/MainHeader";
import ReportsCountrySelect from "../../components/ReportsCountrySelect";
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

    getReportHistory({
      selectedWhatsappIds:
        JSON.parse(localStorage.getItem("ReportsWhatsappSelect")) ||
        selectedWhatsappIds,
      selectedCountryIds:
        JSON.parse(localStorage.getItem("ReportsCountrySelect")) ||
        selectedCountryIds,
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
    });

    (async () => {
      try {
        const { data } = await api.get(`/countries`);
        if (data?.countries?.length > 0) {
          setCountries(data.countries);
        }
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

      setLoadingReportHistoryWithDateRange(false);
    } catch (error) {
      console.log(error);
      toastError(error);
    }
  };

  const getReportToExcel = async ({
    fromDate,
    toDate,
    selectedWhatsappIds,
    selectedCountryIds,
  }) => {
    try {
      const { data: reportToExcel } = await api.get("/reportToExcel", {
        params: {
          fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
          selectedCountryIds: JSON.stringify(selectedCountryIds),
        },
      });

      if (reportToExcel) {
        console.log("reportToExcel: ", reportToExcel);

        const dataToExport = reportToExcel.ticketListFinal.map((row) => ({
          "N. DE TICKET": row.tid,
          CREACIÓN_FECHA: format(new Date(row.tcreatedAt), "dd-MM-yyyy"),
          CREACIÓN_HORA: format(new Date(row.tcreatedAt), "HH:mm"),
          CONTACTO: row.ctname,
          NUMERO: row.tisGroup ? "NO APLICA" : row.ctnumber,
          PAIS: row.ctcname,
          CONEXIÓN: row.wname,
          "ES GRUPO?": row.tisGroup ? "SI" : "NO",
          ASIGNADO: row.tisGroup ? "NO APLICA" : row.uname,
          ESTADO: row.tstatus,
          "ESPERANDO?": row.waiting ? "SI" : "NO",
          "T. PRIMERA RESPUESTA": row.firstResponse,
          "T. DE RESOLUCIÓN": row.resolution,
          "T. DE RESPEUSTA PROM.": row.avgResponse,
          QUINTAL: row.quintalHours,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${"WHATREST"}.xlsx`);
      }
    } catch (error) {
      console.log(error);
      toastError(error);
    }
  };

  const getReportHistory = async ({
    selectedWhatsappIds,
    selectedCountryIds,
  }) => {
    try {
      setLoadingReportHistory(true);

      const { data: reportHistory } = await api.get("/reportHistory", {
        params: {
          selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
          selectedCountryIds: JSON.stringify(selectedCountryIds),
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

  const exportToExcel = () => {
    try {
      const dataToExport = createdTicketsData.map((ticket) => ({
        NÚMERO: ticket.id,
        CREACIÓN_FECHA: format(
          new Date(ticket.createdAt.replace("Z", "")),
          "dd-MM-yyyy"
        ),
        CREACIÓN_HORA: format(
          new Date(ticket.createdAt.replace("Z", "")),
          "HH:mm"
        ),
        CONTACTO: ticket.contact?.name,
        CONEXIÓN: ticket.whatsapp?.name,
        USUARIO: ticket.user?.name,
        ESTADO: ticket.status,
      }));

      tprData.map((tpr) => {
        const ticketToAddTprData = dataToExport.find((d) => {
          return d.NÚMERO === tpr.ticket.id;
        });

        // console.log("ticketToAddTprData:", ticketToAddTprData, tpr);

        if (ticketToAddTprData) {
          ticketToAddTprData["TPR_MENSAJE_CLIENTE_CUERPO"] =
            tpr.tprFirstMessage.body;
          ticketToAddTprData["TPR_MENSAJE_USUARIO_FECHA"] = tpr
            .tprFirstUserMessage?.timestamp
            ? format(
                new Date(tpr.tprFirstUserMessage.timestamp * 1000),
                "dd-MM-yyyy"
              )
            : "-";
          ticketToAddTprData["TPR_MENSAJE_USUARIO_HORA"] = tpr
            .tprFirstUserMessage?.timestamp
            ? format(
                new Date(tpr.tprFirstUserMessage?.timestamp * 1000),
                "HH:mm"
              )
            : "-";
          ticketToAddTprData["TPR_MENSAJE_USUARIO_CUERPO"] = tpr
            .tprFirstUserMessage?.body
            ? tpr.tprFirstUserMessage?.body
            : "-";
          ticketToAddTprData["TPR_EN_SEGUNDOS"] = tpr.tprItem;
        }
      });

      createdTicketsClosedInTheRangeTimeData.map((i) => {
        const ticketToAddTdrData = dataToExport.find((d) => {
          return d.NÚMERO === i.id;
        });

        // console.log("ticketToAddTdrData:", ticketToAddTdrData, i);

        if (ticketToAddTdrData) {
          ticketToAddTdrData["CERRADO_FECHA"] = i.messages[
            i.messages.length - 1
          ]?.timestamp
            ? format(
                new Date(i.messages[i.messages.length - 1].timestamp * 1000),
                "dd-MM-yyyy"
              )
            : "-";
          ticketToAddTdrData["CERRADO_HORA"] = i.messages[i.messages.length - 1]
            ?.timestamp
            ? format(
                new Date(i.messages[i.messages.length - 1].timestamp * 1000),
                "HH:mm"
              )
            : "-";
        }
      });

      tdrData.map((tdr) => {
        const ticketToAddTdrData = dataToExport.find((d) => {
          return d.NÚMERO === tdr.ticket.id;
        });

        if (ticketToAddTdrData) {
          ticketToAddTdrData["TDR_EN_SEGUNDOS"] = tdr.tdrItem;
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(workbook, `${"WHATREST"}.xlsx`);
    } catch (error) {
      console.log("-----------error", error);
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
                <div>
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
                </div>
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
                <span>Tiempo de respuesta total</span>
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
                <span>Distribución de respuesta total</span>
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

                <ButtonWithSpinner
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    getReportHistoryWithDateRange({
                      fromDate,
                      toDate,
                      selectedWhatsappIds,
                      selectedCountryIds,
                    });
                  }}
                  loading={loadingReportHistoryWithDateRange}
                >
                  Actualizar
                </ButtonWithSpinner>
              </div>
            </MainHeader>
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
                <div style={{ display: "flex" }}></div>
                <Button
                  variant="contained"
                  style={{ color: "white", backgroundColor: "#2de241" }}
                  onClick={() =>
                    getReportToExcel({
                      fromDate,
                      toDate,
                      selectedWhatsappIds,
                      selectedCountryIds,
                    })
                  }
                >
                  Exportar a Excel
                </Button>
              </div>
            </MainHeader>
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
