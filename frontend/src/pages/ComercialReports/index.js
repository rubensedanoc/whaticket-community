import { format } from "date-fns";
import React, { Fragment, useContext, useEffect, useState } from "react";

import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import MainHeader from "../../components/MainHeader";
import MarketingCampaignSelect from "../../components/MarketingCampaignSelect";
import ReportsCountrySelect from "../../components/ReportsCountrySelect";
import ReportsWhatsappSelect from "../../components/ReportsWhatsappSelect";
import TicketListModal from "../../components/TicketListModal";
import Title from "../../components/Title";
import UsersSelect from "../../components/UsersSelect";

import Typography from "@material-ui/core/Typography";

import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const ComercialReports = () => {
  const classes = useStyles();

  const [countries, setCountries] = useState([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState([]);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(6);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [selectedMarketingCampaignsIds, setSelectedMarketingCampaignsIds] =
    useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUsersIds, setSelectedUsersIds] = useState([]);

  const [fromDate, setFromDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 00:00:00"
  );
  const [toDate, setToDate] = useState(
    format(new Date(), "yyyy-MM-dd") + " 23:59:59"
  );
  const [ticketStatus, setTicketStatus] = useState("open");

  const [
    loadingTicketsDistributionByStages,
    setLoadingTicketsDistributionByStages,
  ] = useState(true);

  const [ticketsDistributionByStages, setTicketsDistributionByStages] =
    useState({
      values: null,
      ticketsCount: null,
    });
  const [
    ticketsDistributionByStagesAndUsers,
    setTicketsDistributionByStagesAndUsers,
  ] = useState(null);

  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTickets, setTicketListModalTickets] = useState([]);

  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (localStorage.getItem("ReportsCountrySelect")) {
      setSelectedCountryIds(
        JSON.parse(localStorage.getItem("ReportsCountrySelect"))
      );
    }

    if (localStorage.getItem("MarketingCampaignsIds")) {
      setSelectedMarketingCampaignsIds(
        JSON.parse(localStorage.getItem("MarketingCampaignsIds"))
      );
    }

    if (localStorage.getItem("ReportsSelectedUsersIds")) {
      setSelectedUsersIds(
        JSON.parse(localStorage.getItem("ReportsSelectedUsersIds"))
      );
    }

    getTicketsDistributionByStages({
      fromDate,
      toDate,
      selectedWhatsappIds,
      selectedCountryIds:
        JSON.parse(localStorage.getItem("ReportsCountrySelect")) ||
        selectedCountryIds,
      selectedQueueId,
      selectedMarketingCampaignsIds:
        JSON.parse(localStorage.getItem("MarketingCampaignsIds")) ||
        selectedMarketingCampaignsIds,
      selectedUsersIds:
        user.profile === "admin"
          ? JSON.parse(localStorage.getItem("ReportsSelectedUsersIds")) ||
            selectedUsersIds
          : [user.id],
      ticketStatus,
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

  const getTicketsDistributionByStages = async ({
    fromDate,
    toDate,
    selectedWhatsappIds,
    selectedCountryIds,
    selectedQueueId,
    selectedMarketingCampaignsIds,
    selectedUsersIds,
    ticketStatus,
  }) => {
    try {
      setLoadingTicketsDistributionByStages(true);

      const { data: ticketsDistributionByStages } = await api.get(
        "/getTicketsDistributionByStages",
        {
          params: {
            fromDate: format(new Date(fromDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            toDate: format(new Date(toDate), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            selectedWhatsappIds: JSON.stringify(selectedWhatsappIds),
            selectedCountryIds: JSON.stringify(selectedCountryIds),
            selectedQueueId: JSON.stringify(selectedQueueId),
            selectedMarketingCampaignsIds: JSON.stringify(
              selectedMarketingCampaignsIds
            ),
            selectedUsersIds: JSON.stringify(selectedUsersIds),
            ticketStatus: JSON.stringify(ticketStatus),
          },
        }
      );

      setTicketsDistributionByStages({
        ticketsCount: ticketsDistributionByStages.data.ticketsCount,
        values: ticketsDistributionByStages.data.values.sort((a, b) => {
          const aOrder =
            ticketsDistributionByStages.categoryRelationsOfSelectedQueue.find(
              (c) => c.categoryId == a.categoryId
            )?.processOrder || 0;

          const bOrder =
            ticketsDistributionByStages.categoryRelationsOfSelectedQueue.find(
              (c) => c.categoryId == b.categoryId
            )?.processOrder || 0;

          return aOrder - bOrder;
        }),
      });
      setTicketsDistributionByStagesAndUsers(
        (() => {
          const dataByUserSorted = {};

          for (const userId in ticketsDistributionByStages.dataByUser) {
            if (
              Object.prototype.hasOwnProperty.call(
                ticketsDistributionByStages.dataByUser,
                userId
              )
            ) {
              const dataOfUser = ticketsDistributionByStages.dataByUser[userId];

              dataByUserSorted[userId] = {
                ticketsCount: dataOfUser.ticketsCount,
                values: dataOfUser.values.sort((a, b) => {
                  const aOrder =
                    ticketsDistributionByStages.categoryRelationsOfSelectedQueue.find(
                      (c) => c.categoryId == a.categoryId
                    )?.processOrder || 0;

                  const bOrder =
                    ticketsDistributionByStages.categoryRelationsOfSelectedQueue.find(
                      (c) => c.categoryId == b.categoryId
                    )?.processOrder || 0;

                  return aOrder - bOrder;
                }),
              };
            }
          }

          return dataByUserSorted;
        })()
      );
      setLoadingTicketsDistributionByStages(false);
    } catch (error) {
      console.log(error);
      toastError(error);
      setLoadingTicketsDistributionByStages(false);
    }
  };

  function asignarColoresACampañas(campañas, opaco = false) {
    return campañas.map((campaña, index) => {
      const hue = (index * 137.5) % 360; // Espaciado dorado para colores bien distribuidos
      const luminosidad = opaco ? "30%" : "50%"; // Ajusta la luminosidad para hacer los colores más oscuros si opaco es true
      const color = `hsl(${hue}, 70%, ${luminosidad})`; // Genera el color en formato HSL
      return { ...campaña, color };
    });
  }

  return (
    <div>
      {/* MODALS */}
      <TicketListModal
        modalOpen={ticketListModalOpen}
        title={ticketListModalTitle}
        tickets={ticketListModalTickets}
        onClose={() => setTicketListModalOpen(false)}
        newView={true}
        divideByProperty={"marketingCampaign.name"}
        divideByPropertyNullValue={"Sin campaña"}
      />

      {/* CONTENT */}
      <Container maxWidth="lg" className={classes.container}>
        {/* HEADER */}
        <MainHeader>
          <div
            style={{
              display: "flex",
              // justifyContent: "space-between",
              width: "100%",
              alignItems: "start",
            }}
          >
            {/* <div style={{ display: "flex" }}> */}
            <div
              style={{
                marginTop: 8,
              }}
            >
              <Title>Reportes</Title>
            </div>
            <div
              style={{
                marginLeft: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexGrow: 1,
                flexWrap: "wrap",
              }}
            >
              {user.profile === "admin" && (
                <>
                  <UsersSelect
                    selectedIds={selectedUsersIds}
                    onChange={(values) => {
                      localStorage.setItem(
                        "ReportsSelectedUsersIds",
                        JSON.stringify(values)
                      );
                      setSelectedUsersIds(values);
                    }}
                    onLoadData={(data) => {
                      // console.log("users data", data);
                      setUsers(data);
                    }}
                    chips={false}
                  />
                </>
              )}

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

              <MarketingCampaignSelect
                selectedIds={selectedMarketingCampaignsIds}
                onChange={(values) => {
                  localStorage.setItem(
                    "MarketingCampaignsIds",
                    JSON.stringify(values)
                  );
                  setSelectedMarketingCampaignsIds(values);
                }}
                onLoadData={(data) => {
                  setMarketingCampaigns(
                    asignarColoresACampañas(data, ticketStatus === "closed")
                  );
                }}
                chips={false}
              />

              <TextField
                id="date"
                label="Desde"
                type="datetime-local"
                variant="outlined"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={classes.textField}
                style={{ width: 220 }}
                margin="dense"
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
                style={{ width: 220 }}
                margin="dense"
                InputLabelProps={{
                  shrink: true,
                }}
              />

              <div>
                <FormControl fullWidth margin="dense" variant="outlined">
                  <InputLabel>Tickets</InputLabel>
                  <Select
                    label={"Usuarios"}
                    value={ticketStatus}
                    onChange={(e) => setTicketStatus(e.target.value)}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    <MenuItem value={"open"}>Abiertos</MenuItem>
                    <MenuItem value={"closed"}>Cerrados</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </div>
            {/* </div> */}
            <ButtonWithSpinner
              style={{ marginTop: 8 }}
              variant="contained"
              color="primary"
              onClick={() => {
                getTicketsDistributionByStages({
                  fromDate,
                  toDate,
                  selectedWhatsappIds,
                  selectedCountryIds,
                  selectedQueueId,
                  selectedMarketingCampaignsIds,
                  selectedUsersIds:
                    user.profile === "admin" ? selectedUsersIds : [user.id],
                  ticketStatus,
                });
              }}
              loading={loadingTicketsDistributionByStages}
            >
              Actualizar
            </ButtonWithSpinner>
          </div>
        </MainHeader>

        {/* BODY */}
        <Grid container spacing={3}>
          {user.profile === "admin" && (
            <>
              {/* GENERAL DISTRIBUTION CARD */}
              <Grid item xs={12}>
                <Paper className={classes.customFixedHeightPaper}>
                  {/* CARD HEADER */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <Typography
                      component="h3"
                      variant="h6"
                      color="primary"
                      paragraph
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        Distribución General -{" "}
                        {ticketsDistributionByStages.ticketsCount}
                      </span>
                    </Typography>
                  </div>

                  {/* CARD CHART */}
                  {ticketsDistributionByStages.values ? (
                    (() => {
                      let allCampaignsFormatIds = [];

                      ticketsDistributionByStages.values.forEach(
                        (ticketsDistribution) => {
                          const keys = Object.keys(ticketsDistribution);

                          keys
                            .filter((k) => k.includes("campaign_"))
                            .forEach((key) => {
                              if (allCampaignsFormatIds.includes(key)) {
                                return;
                              }
                              allCampaignsFormatIds.push(key);
                            });
                        }
                      );

                      return (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={ticketsDistributionByStages.values}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="categoryName"
                              fontSize={16}
                              fontWeight={"bold"}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis tickLine={false} axisLine={false} />
                            <Tooltip
                              cursor={{ fill: "#0000000a" }}
                              formatter={(value, name) => {
                                const id = name.replace("campaign_", "");
                                return [
                                  value,
                                  marketingCampaigns.find((mc) => mc.id == id)
                                    ?.name || "Sin campaña",
                                ];
                              }}
                            />
                            <Legend
                              wrapperStyle={{
                                bottom: 0,
                                gap: "1rem",
                              }}
                              formatter={(value) => {
                                const id = value.replace("campaign_", "");
                                return (
                                  marketingCampaigns.find((mc) => mc.id == id)
                                    ?.name || "Sin campaña"
                                );
                              }}
                            />

                            {allCampaignsFormatIds.map((id, index) => (
                              <Fragment key={id}>
                                <Bar
                                  onClick={(e) => {
                                    console.log("e", e);
                                    setTicketListModalOpen(true);
                                    setTicketListModalTitle(
                                      `Tickets en "${e.categoryName}" por campaña`
                                    );
                                    setTicketListModalTickets(
                                      e.tickets.map((t) => {
                                        return t.t_id;
                                      })
                                    );
                                  }}
                                  dataKey={`${id}`}
                                  stackId="a"
                                  fill={
                                    marketingCampaigns.find(
                                      (mc) =>
                                        mc.id == id.replaceAll("campaign_", "")
                                    )?.color || "gray"
                                  }
                                >
                                  {index ===
                                    allCampaignsFormatIds.length - 1 && (
                                    <LabelList
                                      position="top"
                                      offset={12}
                                      className="fill-foreground"
                                      fontWeight={"bold"}
                                      fontSize={12}
                                      formatter={(value) => value}
                                    />
                                  )}
                                </Bar>
                              </Fragment>
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()
                  ) : (
                    <>cargando</>
                  )}
                </Paper>
              </Grid>
            </>
          )}

          {/* <Divider orientation="horizontal" flexItem /> */}

          {/* DISTRIBUTION BY USERS CARDS */}
          {ticketsDistributionByStagesAndUsers &&
            (() => {
              const componentsToReturn = [];

              for (const ticketsDistributionByStagesAndUsersKey in ticketsDistributionByStagesAndUsers) {
                if (
                  Object.prototype.hasOwnProperty.call(
                    ticketsDistributionByStagesAndUsers,
                    ticketsDistributionByStagesAndUsersKey
                  )
                ) {
                  const userTicketsCount =
                    ticketsDistributionByStagesAndUsers[
                      ticketsDistributionByStagesAndUsersKey
                    ].ticketsCount;
                  const ticketDistribution =
                    ticketsDistributionByStagesAndUsers[
                      ticketsDistributionByStagesAndUsersKey
                    ].values;

                  componentsToReturn.push(
                    <Grid
                      item
                      xs={12}
                      key={ticketsDistributionByStagesAndUsersKey}
                    >
                      <Paper className={classes.customFixedHeightPaper}>
                        {/* CARD HEADER */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "start",
                          }}
                        >
                          <Typography
                            component="h3"
                            variant="h6"
                            color="primary"
                            paragraph
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>
                              Distribución de{" "}
                              {users.find(
                                (u) =>
                                  u.id == ticketsDistributionByStagesAndUsersKey
                              )?.name || "Usuario"}{" "}
                              - {userTicketsCount}
                            </span>
                          </Typography>
                        </div>

                        {/* CARD CHART */}
                        {ticketDistribution ? (
                          (() => {
                            let allCampaignsFormatIds = [];

                            ticketDistribution.forEach(
                              (ticketsDistribution) => {
                                const keys = Object.keys(ticketsDistribution);

                                keys
                                  .filter((k) => k.includes("campaign_"))
                                  .forEach((key) => {
                                    if (allCampaignsFormatIds.includes(key)) {
                                      return;
                                    }
                                    allCampaignsFormatIds.push(key);
                                  });
                              }
                            );

                            return (
                              <ResponsiveContainer width="100%" height={400}>
                                <BarChart
                                  data={ticketDistribution}
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 20,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                  />
                                  <XAxis
                                    dataKey="categoryName"
                                    fontSize={16}
                                    fontWeight={"bold"}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis tickLine={false} axisLine={false} />
                                  <Tooltip
                                    cursor={{ fill: "#0000000a" }}
                                    formatter={(value, name) => {
                                      const id = name.replace("campaign_", "");
                                      return [
                                        value,
                                        marketingCampaigns.find(
                                          (mc) => mc.id == id
                                        )?.name || "Sin campaña",
                                      ];
                                    }}
                                  />
                                  <Legend
                                    wrapperStyle={{
                                      bottom: 0,
                                      gap: "1rem",
                                    }}
                                    formatter={(value) => {
                                      const id = value.replace("campaign_", "");
                                      return (
                                        marketingCampaigns.find(
                                          (mc) => mc.id == id
                                        )?.name || "Sin campaña"
                                      );
                                    }}
                                  />

                                  {allCampaignsFormatIds.map((id, index) => (
                                    <Fragment
                                      key={
                                        ticketsDistributionByStagesAndUsersKey +
                                        id
                                      }
                                    >
                                      <Bar
                                        onClick={(e) => {
                                          console.log("e", e);
                                          setTicketListModalOpen(true);
                                          setTicketListModalTitle(
                                            `Tickets en "${e.categoryName}" por campaña`
                                          );
                                          setTicketListModalTickets(
                                            e.tickets.map((t) => {
                                              return t.t_id;
                                            })
                                          );
                                        }}
                                        dataKey={`${id}`}
                                        stackId="a"
                                        fill={
                                          marketingCampaigns.find(
                                            (mc) =>
                                              mc.id ==
                                              id.replaceAll("campaign_", "")
                                          )?.color || "gray"
                                        }
                                      >
                                        {index ===
                                          allCampaignsFormatIds.length - 1 && (
                                          <LabelList
                                            position="top"
                                            offset={12}
                                            className="fill-foreground"
                                            fontSize={12}
                                            fontWeight={"bold"}
                                            formatter={(value) => value}
                                          />
                                        )}
                                      </Bar>
                                    </Fragment>
                                  ))}
                                </BarChart>
                              </ResponsiveContainer>
                            );
                          })()
                        ) : (
                          <>cargando</>
                        )}
                      </Paper>
                    </Grid>
                  );
                }
              }

              return componentsToReturn;
            })()}
        </Grid>
      </Container>
    </div>
  );
};

export default ComercialReports;
