import { format } from "date-fns";
import React, { Fragment, useContext, useEffect, useState } from "react";

import Container from "@material-ui/core/Container";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import MainHeader from "../../components/MainHeader";
import MarketingCampaignSelect from "../../components/MarketingCampaignSelect";
import MarketingMessaginCampaignSelect from "../../components/MarketingMessaginCampaignSelect";
import ReportsCountrySelect from "../../components/ReportsCountrySelect";
import ReportsWhatsappSelect from "../../components/ReportsWhatsappSelect";
import TicketListModalV2 from "../../components/TicketListModalV2";
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

const TicketsDistributionOfCCFByCateogriesChartCard = ({
  ccfName,
  title,
  ticketsCount,
  values,
  setTicketListModalOpen,
  setTicketListModalTitle,
  setTicketListModalTicketGroups,
  categoryRelationsOfSelectedQueue,
  categories,
}) => {
  const classes = useStyles();

  return (
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
            {title} - {ticketsCount}
          </span>
        </Typography>
      </div>

      {/* CARD CHART */}
      {values ? (
        (() => {
          let allCategoryIds = [];

          values.forEach((ticketsDistribution) => {
            const keys = Object.keys(ticketsDistribution);

            keys
              .filter((k) => k.includes("category_"))
              .forEach((key) => {
                if (allCategoryIds.includes(key)) {
                  return;
                }
                allCategoryIds.push(key);
              });
          });

          allCategoryIds.sort((a, b) => {
            const aOrder =
              categoryRelationsOfSelectedQueue.find(
                (c) => c.categoryId == a.replace("category_", "")
              )?.processOrder || 0;

            const bOrder =
              categoryRelationsOfSelectedQueue?.find(
                (c) => c.categoryId == b.replace("category_", "")
              )?.processOrder || 0;

            return aOrder - bOrder;
          });

          return (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={values}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={ccfName}
                  fontSize={12}
                  fontWeight={"bold"}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} width={20} />
                <Tooltip
                  cursor={{ fill: "#0000000a" }}
                  formatter={(value, name, item, index, payload) => {
                    const id = name.replace("category_", "");
                    return [
                      `${value} (${Math.round(
                        (value /
                          payload.reduce((acc, cur) => {
                            return acc + cur.value;
                          }, 0)) *
                          100
                      )}%)`,
                      categories.find((mc) => mc.id == id)?.name ||
                        "Sin categpría",
                    ];
                  }}
                />
                <Legend
                  wrapperStyle={{
                    bottom: 0,
                    gap: "1rem",
                  }}
                  formatter={(value) => {
                    const id = value.replace("category_", "");
                    return (
                      categories.find((mc) => mc.id == id)?.name ||
                      "Sin categoría"
                    );
                  }}
                />

                {allCategoryIds.map((id, index) => (
                  <Fragment key={id}>
                    <Bar
                      onClick={(e) => {
                        console.log("e", e);
                        setTicketListModalOpen(true);
                        setTicketListModalTitle(`Tickets por "${title}"`);
                        setTicketListModalTicketGroups(
                          e.tickets.reduce((acc, t) => {
                            const categoryName =
                              categories.find((c) => c.id == t.tc_categoryId)
                                ?.name || "Sin categoría";

                            const categoryNameIndexInResult = acc.findIndex(
                              (g) => g.title === categoryName
                            );

                            if (categoryNameIndexInResult > -1) {
                              acc[categoryNameIndexInResult].ids.push(t.t_id);
                            } else {
                              acc.push({
                                title: categoryName,
                                ids: [t.t_id],
                              });
                            }

                            return acc;
                          }, [])
                        );
                      }}
                      capHeight={10}
                      dataKey={`${id}`}
                      stackId="b"
                      fill={
                        categories.find(
                          (c) => c.id == id.replaceAll("category_", "")
                        )?.color || "gray"
                      }
                    >
                      {index === allCategoryIds.length - 1 && (
                        <LabelList
                          position="top"
                          offset={12}
                          className="fill-foreground"
                          fontWeight={"bold"}
                          fontSize={12}
                          formatter={(value) => {
                            return `${value} (${Math.round(
                              (value / ticketsCount) * 100
                            )}%)`;
                          }}
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
  );
};

const TicketsDistributionOfCCFByCateogriesListCard = ({
  ccfName,
  title,
  ticketsCount,
  values,
  setTicketListModalOpen,
  setTicketListModalTitle,
  setTicketListModalTicketGroups,
  categoryRelationsOfSelectedQueue,
  categories,
}) => {
  const classes = useStyles();

  return (
    <Paper
      className={classes.customFixedHeightPaper}
      style={{ height: "25rem" }}
    >
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
            {title} - {ticketsCount}
          </span>
        </Typography>
      </div>

      {values ? (
        <div>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell align="center">Nombre</TableCell>
                <TableCell align="center">Cantidad</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <>
                {values.map((value, index) => {
                  return (
                    <TableRow
                      key={index}
                      style={{
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        setTicketListModalOpen(true);
                        setTicketListModalTitle(`Tickets por "${title}"`);
                        setTicketListModalTicketGroups([
                          {
                            title: value[ccfName],
                            ids: value.tickets.map((t) => t.t_id),
                          },
                        ]);
                      }}
                    >
                      <TableCell align="center">{value[ccfName]}</TableCell>
                      <TableCell
                        align="center"
                        style={{
                          cursor: "pointer",
                          color: "blue",
                          textDecoration: "underline",
                        }}
                      >
                        {value.tickets?.length}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            </TableBody>
          </Table>
        </div>
      ) : (
        <>cargando</>
      )}
    </Paper>
  );
};

const ComercialReports = () => {
  const classes = useStyles();

  const [countries, setCountries] = useState([]);
  const [selectedCountryIds, setSelectedCountryIds] = useState([]);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(6);
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMarketingCampaignsIds, setSelectedMarketingCampaignsIds] =
    useState([]);
  const [
    selectedMarketingMessaginCampaignsIds,
    setSelectedMarketingMessaginCampaignsIds,
  ] = useState([]);
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
  const [ticketsDistributionByStages2, setTicketsDistributionByStages2] =
    useState({
      values: null,
      ticketsCount: null,
    });
  const [
    ticketsDistributionByTIENE_RESTAURANTE,
    setTicketsDistributionByTIENE_RESTAURANTE,
  ] = useState({
    values: null,
    ticketsCount: null,
  });
  const [
    ticketsDistributionByYA_USA_SISTEMA,
    setTicketsDistributionByYA_USA_SISTEMA,
  ] = useState({
    values: null,
    ticketsCount: null,
  });
  const [ticketsDistributionByCARGO, setTicketsDistributionByCARGO] = useState({
    values: null,
    ticketsCount: null,
  });
  const [
    ticketsDistributionByTIPO_RESTAURANTE,
    setTicketsDistributionByTIPO_RESTAURANTE,
  ] = useState({
    values: null,
    ticketsCount: null,
  });
  const [
    ticketsDistributionBySISTEMA_ACTUAL,
    setTicketsDistributionBySISTEMA_ACTUAL,
  ] = useState({
    values: null,
    ticketsCount: null,
  });
  const [
    ticketsDistributionByCOMO_SE_ENTERO,
    setTicketsDistributionByCOMO_SE_ENTERO,
  ] = useState({
    values: null,
    ticketsCount: null,
  });
  const [ticketsDistributionByDOLOR, setTicketsDistributionByDOLOR] = useState({
    values: null,
    ticketsCount: null,
  });
  const [
    ticketsDistributionByCUANTO_PAGA,
    setTicketsDistributionByCUANTO_PAGA,
  ] = useState({
    tickets: null,
    ticketsCount: null,
    ticketsAvr: null,
  });
  const [
    ticketsDistributionByStagesAndUsers,
    setTicketsDistributionByStagesAndUsers,
  ] = useState(null);

  const [
    categoryRelationsOfSelectedQueue,
    setCategoryRelationsOfSelectedQueue,
  ] = useState([]);

  const [ticketListModalOpen, setTicketListModalOpen] = useState(false);
  const [ticketListModalTitle, setTicketListModalTitle] = useState("");
  const [ticketListModalTicketGroups, setTicketListModalTicketGroups] =
    useState([]);

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

    // if (localStorage.getItem("MarketingMessaginCampaignsIds")) {
    //   setSelectedMarketingMessaginCampaignsIds(
    //     JSON.parse(localStorage.getItem("MarketingMessaginCampaignsIds"))
    //   );
    // }

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
      selectedMarketingMessaginCampaignsIds,
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

  // load categories
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data);
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
    selectedMarketingMessaginCampaignsIds,
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
            selectedMarketingMessaginCampaignsIds: JSON.stringify(
              selectedMarketingMessaginCampaignsIds
            ),
          },
        }
      );

      setCategoryRelationsOfSelectedQueue(
        ticketsDistributionByStages.categoryRelationsOfSelectedQueue
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
      setTicketsDistributionByStages2({
        ticketsCount: ticketsDistributionByStages.data2.ticketsCount,
        values: ticketsDistributionByStages.data2.values.map((v) => {
          return {
            ...v,
            userName: formatName(v.userName),
          };
        }),
      });
      setTicketsDistributionByTIENE_RESTAURANTE({
        ticketsCount:
          ticketsDistributionByStages.dataByTIENE_RESTAURANTE.ticketsCount,
        values: ticketsDistributionByStages.dataByTIENE_RESTAURANTE.values,
      });
      setTicketsDistributionByYA_USA_SISTEMA({
        ticketsCount:
          ticketsDistributionByStages.dataByYA_USA_SISTEMA.ticketsCount,
        values: ticketsDistributionByStages.dataByYA_USA_SISTEMA.values,
      });
      setTicketsDistributionByCARGO({
        ticketsCount: ticketsDistributionByStages.dataByCARGO.ticketsCount,
        values: ticketsDistributionByStages.dataByCARGO.values,
      });
      setTicketsDistributionByTIPO_RESTAURANTE({
        ticketsCount:
          ticketsDistributionByStages.dataByTIPO_RESTAURANTE.ticketsCount,
        values: ticketsDistributionByStages.dataByTIPO_RESTAURANTE.values,
      });
      setTicketsDistributionBySISTEMA_ACTUAL({
        ticketsCount:
          ticketsDistributionByStages.dataBySISTEMA_ACTUAL.ticketsCount,
        values: ticketsDistributionByStages.dataBySISTEMA_ACTUAL.values,
      });
      setTicketsDistributionByCOMO_SE_ENTERO({
        ticketsCount:
          ticketsDistributionByStages.dataByCOMO_SE_ENTERO.ticketsCount,
        values: ticketsDistributionByStages.dataByCOMO_SE_ENTERO.values,
      });
      setTicketsDistributionByCUANTO_PAGA({
        ticketsCount:
          ticketsDistributionByStages.dataByCUANTO_PAGA.ticketsCount,
        tickets: ticketsDistributionByStages.dataByCUANTO_PAGA.tickets,
        ticketsAvr: ticketsDistributionByStages.dataByCUANTO_PAGA.ticketsAvr,
      });
      setTicketsDistributionByDOLOR({
        ticketsCount: ticketsDistributionByStages.dataByDOLOR.ticketsCount,
        values: ticketsDistributionByStages.dataByDOLOR.values,
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

  function formatName(fullName) {
    // Divide el nombre completo en partes
    const parts = fullName.split(" ");

    // Asegúrate de que hay al menos dos partes para nombre y apellido
    if (parts.length < 2) {
      return fullName; // Retorna el nombre tal cual si no hay suficientes partes
    }

    // Toma el primer nombre
    const firstName = parts[0];

    // Toma la inicial del segundo nombre o apellido
    const lastInitial = parts[1].charAt(0).toUpperCase();

    // Retorna el formato "Abel Q."
    return `${firstName} ${lastInitial}.`;
  }

  return (
    <div>
      {/* MODALS */}
      {/* <TicketListModal
        modalOpen={ticketListModalOpen}
        title={ticketListModalTitle}
        tickets={ticketListModalTickets}
        onClose={() => setTicketListModalOpen(false)}
        newView={true}
        divideByProperty={"marketingCampaign.name"}
        divideByPropertyNullValue={"Sin campaña"}
      /> */}

      <TicketListModalV2
        open={ticketListModalOpen}
        title={ticketListModalTitle}
        structuredTicketIds={ticketListModalTicketGroups}
        onClose={() => setTicketListModalOpen(false)}
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

              <MarketingMessaginCampaignSelect
                selectedIds={selectedMarketingMessaginCampaignsIds}
                visibleIds={selectedMarketingCampaignsIds}
                onChange={(values) => {
                  // localStorage.setItem(
                  //   "MarketingMessaginCampaignsIds",
                  //   JSON.stringify(values)
                  // );
                  setSelectedMarketingMessaginCampaignsIds(values);
                }}
                chips={false}
              />

              <div>
                <FormControl fullWidth margin="dense" variant="outlined">
                  <InputLabel>Tickets</InputLabel>
                  <Select
                    label={"Tickets"}
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
                    <MenuItem value={"all"}>Todos</MenuItem>
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
                  selectedMarketingMessaginCampaignsIds,
                });
              }}
              loading={loadingTicketsDistributionByStages}
            >
              Actualizar
            </ButtonWithSpinner>
          </div>
        </MainHeader>

        {/* BODY */}
        <Grid
          container
          spacing={4}
          style={{ flexDirection: "row", justifyContent: "center" }}
        >
          {user.profile === "admin" && (
            <>
              {/* Distribución General por Usuario/Etapas CARD */}
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
                        Distribución General por Usuario/Etapas -{" "}
                        {ticketsDistributionByStages2.ticketsCount}
                      </span>
                    </Typography>
                  </div>

                  {/* CARD CHART */}
                  {ticketsDistributionByStages2.values ? (
                    (() => {
                      let allCategoryIds = [];

                      ticketsDistributionByStages2.values.forEach(
                        (ticketsDistribution) => {
                          const keys = Object.keys(ticketsDistribution);

                          keys
                            .filter((k) => k.includes("category_"))
                            .forEach((key) => {
                              if (allCategoryIds.includes(key)) {
                                return;
                              }
                              allCategoryIds.push(key);
                            });
                        }
                      );

                      allCategoryIds.sort((a, b) => {
                        const aOrder =
                          categoryRelationsOfSelectedQueue.find(
                            (c) => c.categoryId == a.replace("category_", "")
                          )?.processOrder || 0;

                        const bOrder =
                          categoryRelationsOfSelectedQueue?.find(
                            (c) => c.categoryId == b.replace("category_", "")
                          )?.processOrder || 0;

                        return aOrder - bOrder;
                      });

                      console.log("allCategoryIds", allCategoryIds);
                      console.log(
                        "categoryRelationsOfSelectedQueue",
                        categoryRelationsOfSelectedQueue
                      );

                      return (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={ticketsDistributionByStages2.values}
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
                              dataKey="userName"
                              fontSize={12}
                              fontWeight={"bold"}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={20}
                            />
                            <Tooltip
                              cursor={{ fill: "#0000000a" }}
                              formatter={(
                                value,
                                name,
                                item,
                                index,
                                payload
                              ) => {
                                const id = name.replace("category_", "");
                                return [
                                  `${value} (${Math.round(
                                    (value /
                                      payload.reduce((acc, cur) => {
                                        return acc + cur.value;
                                      }, 0)) *
                                      100
                                  )}%)`,
                                  categories.find((mc) => mc.id == id)?.name ||
                                    "Sin categpría",
                                ];
                              }}
                            />
                            <Legend
                              wrapperStyle={{
                                bottom: 0,
                                gap: "1rem",
                              }}
                              formatter={(value) => {
                                const id = value.replace("category_", "");
                                return (
                                  categories.find((mc) => mc.id == id)?.name ||
                                  "Sin categoría"
                                );
                              }}
                            />

                            {allCategoryIds.map((id, index) => (
                              <Fragment key={id}>
                                <Bar
                                  onClick={(e) => {
                                    console.log("e", e);
                                    setTicketListModalOpen(true);
                                    setTicketListModalTitle(
                                      `Tickets de "${e?.payload?.userName}" por etapas`
                                    );
                                    setTicketListModalTicketGroups(
                                      e.tickets.reduce((acc, t) => {
                                        const categoryName =
                                          categories.find(
                                            (c) => c.id == t.tc_categoryId
                                          )?.name || "Sin categoría";

                                        const categoryNameIndexInResult =
                                          acc.findIndex(
                                            (g) => g.title === categoryName
                                          );

                                        if (categoryNameIndexInResult > -1) {
                                          acc[
                                            categoryNameIndexInResult
                                          ].ids.push(t.t_id);
                                        } else {
                                          acc.push({
                                            title: categoryName,
                                            ids: [t.t_id],
                                          });
                                        }

                                        return acc;
                                      }, [])
                                    );
                                  }}
                                  capHeight={10}
                                  dataKey={`${id}`}
                                  stackId="b"
                                  fill={
                                    categories.find(
                                      (c) =>
                                        c.id == id.replaceAll("category_", "")
                                    )?.color || "gray"
                                  }
                                >
                                  {index === allCategoryIds.length - 1 && (
                                    <LabelList
                                      position="top"
                                      offset={12}
                                      className="fill-foreground"
                                      fontWeight={"bold"}
                                      fontSize={12}
                                      formatter={(value) => {
                                        return `${value} (${Math.round(
                                          (value /
                                            ticketsDistributionByStages2.ticketsCount) *
                                            100
                                        )}%)`;
                                      }}
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

              {/* Distribución General por Etapas/Campañas CARD */}
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
                        Distribución General por Etapas/Campañas -{" "}
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
                              fontSize={12}
                              fontWeight={"bold"}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={20}
                            />
                            <Tooltip
                              cursor={{ fill: "#0000000a" }}
                              formatter={(
                                value,
                                name,
                                item,
                                index,
                                payload
                              ) => {
                                const id = name.replace("campaign_", "");
                                return [
                                  `${value} (${Math.round(
                                    (value /
                                      payload.reduce((acc, cur) => {
                                        return acc + cur.value;
                                      }, 0)) *
                                      100
                                  )}%)`,
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
                                    setTicketListModalTicketGroups(
                                      e.tickets.reduce((acc, t) => {
                                        const mrktCampaignName =
                                          t.mc_name || "Sin campaña";

                                        const mc_nameIndexInResult =
                                          acc.findIndex(
                                            (g) => g.title === mrktCampaignName
                                          );

                                        console.log(
                                          "mc_nameIndexInResult",
                                          mc_nameIndexInResult
                                        );

                                        if (mc_nameIndexInResult > -1) {
                                          acc[mc_nameIndexInResult].ids.push(
                                            t.t_id
                                          );
                                        } else {
                                          acc.push({
                                            title: mrktCampaignName,
                                            ids: [t.t_id],
                                          });
                                        }

                                        return acc;
                                      }, [])
                                    );
                                  }}
                                  capHeight={10}
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
                                      formatter={(value) => {
                                        return `${value} (${Math.round(
                                          (value /
                                            ticketsDistributionByStages.ticketsCount) *
                                            100
                                        )}%)`;
                                      }}
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

              {/* Distribución General por TIENE_RESTAURANTE/Etapas CARD */}
              <Grid item xs={6}>
                <TicketsDistributionOfCCFByCateogriesChartCard
                  ccfName={"TIENE_RESTAURANTE"}
                  title={"Tienen restaurante"}
                  ticketsCount={
                    ticketsDistributionByTIENE_RESTAURANTE.ticketsCount
                  }
                  values={ticketsDistributionByTIENE_RESTAURANTE.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>
              {/* Distribución General por YA_USA_SISTEMA/Etapas CARD */}
              <Grid item xs={6}>
                <TicketsDistributionOfCCFByCateogriesChartCard
                  ccfName={"YA_USA_SISTEMA"}
                  title={"Ya usan sistema"}
                  ticketsCount={
                    ticketsDistributionByYA_USA_SISTEMA.ticketsCount
                  }
                  values={ticketsDistributionByYA_USA_SISTEMA.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>

              {/* Distribución General por CARGO/Etapas CARD */}
              <Grid item xs={4}>
                <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"CARGO"}
                  title={"Cargos"}
                  ticketsCount={ticketsDistributionByCARGO.ticketsCount}
                  values={ticketsDistributionByCARGO.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>

              {/* Distribución General por TIPO_RESTAURANTE/Etapas CARD */}
              <Grid item xs={4}>
                <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"TIPO_RESTAURANTE"}
                  title={"Tipos de restaurante"}
                  ticketsCount={
                    ticketsDistributionByTIPO_RESTAURANTE.ticketsCount
                  }
                  values={ticketsDistributionByTIPO_RESTAURANTE.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>

              {/* Distribución General por SISTEMA_ACTUAL/Etapas CARD */}
              <Grid item xs={4}>
                <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"SISTEMA_ACTUAL"}
                  title={"Sistemas actuales"}
                  ticketsCount={
                    ticketsDistributionBySISTEMA_ACTUAL.ticketsCount
                  }
                  values={ticketsDistributionBySISTEMA_ACTUAL.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>

              {/* Distribución General por COMO_SE_ENTERO/Etapas CARD */}
              <Grid item xs={4}>
                <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"COMO_SE_ENTERO"}
                  title={"Como se enteraron"}
                  ticketsCount={
                    ticketsDistributionByCOMO_SE_ENTERO.ticketsCount
                  }
                  values={ticketsDistributionByCOMO_SE_ENTERO.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>

              {/* Cuanto paga CARD */}
              <Grid item xs={4}>
                <Paper
                  className={classes.customFixedHeightPaper}
                  style={{ height: "25rem" }}
                >
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
                        Promedio de cuánto paga -{" "}
                        {ticketsDistributionByCUANTO_PAGA.ticketsCount}
                      </span>
                    </Typography>
                  </div>

                  {ticketsDistributionByCUANTO_PAGA.ticketsAvr !== null ? (
                    <div>
                      <Table size="medium">
                        <TableHead>
                          <TableRow>
                            <TableCell align="center">Nombre</TableCell>
                            <TableCell align="center">Cantidad</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <>
                            <TableRow
                              style={{
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                setTicketListModalOpen(true);
                                setTicketListModalTitle(
                                  `Tickets de "Promedio de cuánto paga"`
                                );
                                setTicketListModalTicketGroups([
                                  {
                                    ids: ticketsDistributionByCUANTO_PAGA.tickets?.map(
                                      (t) => t.t_id
                                    ),
                                  },
                                ]);
                              }}
                            >
                              <TableCell align="center">
                                Promedio de cuánto paga
                              </TableCell>
                              <TableCell
                                align="center"
                                style={{
                                  cursor: "pointer",
                                  color: "blue",
                                  textDecoration: "underline",
                                }}
                              >
                                {Math.round(
                                  ticketsDistributionByCUANTO_PAGA.ticketsAvr
                                )}{" "}
                                USD Mensual
                              </TableCell>
                            </TableRow>
                          </>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <>cargando</>
                  )}
                </Paper>

                {/* <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"COMO_SE_ENTERO"}
                  title={"Como se enteraron"}
                  ticketsCount={
                    ticketsDistributionByCOMO_SE_ENTERO.ticketsCount
                  }
                  values={ticketsDistributionByCOMO_SE_ENTERO.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                /> */}
              </Grid>

              {/* Distribución General por DOLOR/Etapas CARD */}
              <Grid item xs={4}>
                <TicketsDistributionOfCCFByCateogriesListCard
                  ccfName={"DOLOR"}
                  title={"Dolores"}
                  ticketsCount={ticketsDistributionByDOLOR.ticketsCount}
                  values={ticketsDistributionByDOLOR.values}
                  setTicketListModalOpen={setTicketListModalOpen}
                  setTicketListModalTitle={setTicketListModalTitle}
                  setTicketListModalTicketGroups={
                    setTicketListModalTicketGroups
                  }
                  categoryRelationsOfSelectedQueue={
                    categoryRelationsOfSelectedQueue
                  }
                  categories={categories}
                />
              </Grid>
            </>
          )}

          <Divider
            orientation="horizontal"
            flexItem
            style={{ height: 2, margin: 16 }}
          />

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
                                    fontSize={12}
                                    fontWeight={"bold"}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    width={20}
                                  />
                                  <Tooltip
                                    cursor={{ fill: "#0000000a" }}
                                    formatter={(
                                      value,
                                      name,
                                      item,
                                      index,
                                      payload
                                    ) => {
                                      const id = name.replace("campaign_", "");
                                      return [
                                        `${value} (${Math.round(
                                          (value /
                                            payload.reduce((acc, cur) => {
                                              return acc + cur.value;
                                            }, 0)) *
                                            100
                                        )}%)`,
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

                                          setTicketListModalTicketGroups(
                                            e.tickets.reduce((acc, t) => {
                                              const mrktCampaignName =
                                                t.mc_name || "Sin campaña";

                                              const mc_nameIndexInResult =
                                                acc.findIndex(
                                                  (g) =>
                                                    g.title === mrktCampaignName
                                                );

                                              console.log(
                                                "mc_nameIndexInResult",
                                                mc_nameIndexInResult
                                              );

                                              if (mc_nameIndexInResult > -1) {
                                                acc[
                                                  mc_nameIndexInResult
                                                ].ids.push(t.t_id);
                                              } else {
                                                acc.push({
                                                  title: mrktCampaignName,
                                                  ids: [t.t_id],
                                                });
                                              }

                                              return acc;
                                            }, [])
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
                                            formatter={(value) => {
                                              return `${value} (${Math.round(
                                                (value / userTicketsCount) * 100
                                              )}%)`;
                                            }}
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
