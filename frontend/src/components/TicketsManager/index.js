import React, { useContext, useEffect, useRef, useState } from "react";

import { Checkbox, ListItemText } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import FormControl from "@material-ui/core/FormControl";
import InputBase from "@material-ui/core/InputBase";
import MenuItem from "@material-ui/core/MenuItem";
import Paper from "@material-ui/core/Paper";
import Select from "@material-ui/core/Select";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import SearchIcon from "@material-ui/icons/Search";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import "./styles.css";

import ViewColumnIcon from "@material-ui/icons/ViewColumn";
import ViewWeekIcon from "@material-ui/icons/ViewWeek";

import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

import { IconButton } from "@material-ui/core";
import NumberGroupsModal from "../NumberGroupsModal";
import TicketsWhatsappSelect from "../TicketsWhatsappSelect";

import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import { Can } from "../Can";
import NewTicketModal from "../NewTicketModal";
import TabPanel from "../TabPanel";
import TicketsList from "../TicketsList";
import TicketsCountChips from "../TicketsCountChips";

import { Button, Divider, FormControlLabel, Switch, Chip } from "@material-ui/core";
import Menu from "@material-ui/core/Menu";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import { toast } from "react-toastify";
import { getREACT_APP_PURPOSE } from "../../config";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import MarketingCampaignSelect from "../MarketingCampaignSelect";
import TicketsQueueSelect from "../TicketsQueueSelect";
import NotificationsList from "../NotificationsList";
import NotificationsIcon from '@material-ui/icons/Notifications';
import UsersSelect from "../UsersSelect";
import HomeIcon from '@material-ui/icons/Home';
import InputLabel from "@material-ui/core/InputLabel";

import "./styles.css";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    width: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    background: "#fafafa",
  },

  tabsHeader: {
    flex: "none",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    outline: "0 0 0 5 black",
    // backgroundColor: "#eee",
  },

  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: 8,
  },

  tab: {
    minWidth: 120,
    width: 120,
    fontSize: 12,
  },

  ticketOptionsBox: {
    display: "flex",
    // flexWrap: "wrap",
    justifyContent: "end",
    gap: 10,
    alignItems: "center",
    padding: "8px 16px",
  },

  serachInputWrapper: {
    // minWidth: 200,
    // minWidth: "100%",
    width: "15rem",
    flex: 1,
    background: "#fff",
    display: "flex",
    borderRadius: 40,
    padding: 4,
    marginRight: theme.spacing(1),
    border: "1px solid #ccc",
  },

  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center",
  },

  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30,
  },

  badge: {
    right: "12px",
  },
  show: {
    display: "block",
  },
  hide: {
    display: "none !important",
  },
}));

const StyledTab = withStyles({
  root: {
    minWidth: 72,
  },
})((props) => <Tab {...props} />);

const sinEtapaChipValueId = [null];
const onboardingChipValueId = [6];
const inspTecnicaChipValueId = [1];
const configPlataformaChipValueId = [2];
const configEquiposChipValueId = [3];
const capOpYMonitoreoChipValueId = [4];
const altaChipValueId = [5];
const altaFeChipValueId = [7];
const monitoreoChipValueId = [8];

const TicketsManager = () => {
  const classes = useStyles();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showOnlyMyGroups, setShowOnlyMyGroups] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);

  const userQueueIds = [...user.queues.map((q) => q.id), null];
  const { whatsApps } = useContext(WhatsAppsContext);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  const [principalTicketType, setPrincipalTicketType] = useState("");
  const [principalTicketTypeForGeneralView, setPrincipalTicketTypeForGeneralView] = useState("all");

  const [typeIdsForAll] = useState(["individual", "group"]);
  const [typeIdsForIndividuals] = useState(["individual"]);
  const [typeIdsForGroups] = useState(["group"]);

  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedMarketingCampaignIds, setSelectedMarketingCampaignIds] =
    useState([]);

  const [numberGroups, setNumberGroups] = useState([]);
  const [numberGroupsModalIsOpen, setNumberGroupsModalIsOpen] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorEl2, setAnchorEl2] = useState(null);

  const [categories, setCategories] = useState([]);

  const [selectedCategoriesIds, setSelectedCategoriesIds] = useState([]);

  const [pendingColumnSide, setPendingColumnSide] = useState("left");
  const [secondaryColumnSide, setSecondaryColumnSide] = useState("left");

  const [showOnlyWaitingTickets, setShowOnlyWaitingTickets] = useState(false);

  const [columnsWidth, setColumnsWidth] = useState("normal");
  const [doubleRow, setDoubleRow] = useState(false);
  const [selectedUsersIds, setSelectedUsersIds] = useState([]);
  const [currentUserId, _] = useState([user.id]);
  const [users, setUsers] = useState([]);
  const [selectedTicketUsersIds, setSelectedTicketUsersIds] = useState([]);
  
  const [notificationsCount, setNotificationsCount] = useState(null);

  const [selectedClientelicenciaEtapaIds, setSelectedClientelicenciaEtapaIds] = useState([]);
  
  useEffect(() => {
    localStorage.getItem("principalTicketType") &&
      setPrincipalTicketType(
        JSON.parse(localStorage.getItem("principalTicketType"))
      );

    localStorage.getItem("showAll") &&
      setShowAll(JSON.parse(localStorage.getItem("showAll")));

    localStorage.getItem("showOnlyMyGroups") &&
      setShowOnlyMyGroups(JSON.parse(localStorage.getItem("showOnlyMyGroups")));

    if (user.profile === "admin") {
      localStorage.getItem("selectedWhatsappIds") &&
        setSelectedWhatsappIds(
          JSON.parse(localStorage.getItem("selectedWhatsappIds"))
        );
    }

    // para el caso de los departamentos, primero verificamos si los departamentos
    // seleccionados en el localStorage existen en los departamentos del usuario
    // si no existen, los eliminamos del localStorage
    if (localStorage.getItem("selectedQueueIds")) {
      const selectedQueueIdsFromLocalStorage = JSON.parse(
        localStorage.getItem("selectedQueueIds")
      );

      const selectedQueueIdsAfterFilter =
        selectedQueueIdsFromLocalStorage.filter(
          (selectedQueueId) =>
            user?.queues?.find((queue) => queue.id === selectedQueueId) ||
            selectedQueueId === null
        );

      localStorage.setItem(
        "selectedQueueIds",
        JSON.stringify(selectedQueueIdsAfterFilter)
      );

      setSelectedQueueIds(selectedQueueIdsAfterFilter);
    }

    localStorage.getItem("ticketsPanel-selectedMarketingCampaignIds") &&
      setSelectedMarketingCampaignIds(
        JSON.parse(
          localStorage.getItem("ticketsPanel-selectedMarketingCampaignIds")
        )
      );

    localStorage.getItem("pendingColumnSide") &&
      setPendingColumnSide(
        JSON.parse(localStorage.getItem("pendingColumnSide"))
      );

    localStorage.getItem("secondaryColumnSide") &&
      setSecondaryColumnSide(
        JSON.parse(localStorage.getItem("secondaryColumnSide"))
      );

    localStorage.getItem("TicketsManager-showOnlyWaitingTickets") &&
      setShowOnlyWaitingTickets(
        JSON.parse(
          localStorage.getItem("TicketsManager-showOnlyWaitingTickets")
        )
      );

    localStorage.getItem("TicketsManager-columnsWidth") &&
      setColumnsWidth(
        JSON.parse(localStorage.getItem("TicketsManager-columnsWidth"))
      );

    localStorage.getItem("TicketsManager-doubleRow") &&
      setDoubleRow(
        JSON.parse(localStorage.getItem("TicketsManager-doubleRow"))
      );

    localStorage.getItem("TicketUsersIds") &&
      setSelectedTicketUsersIds(
        JSON.parse(localStorage.getItem("TicketUsersIds"))
      );
  }, []);

  // useEffect(() => {
  //   console.log("selectedTypeIds", selectedTypeIds);
  // }, [selectedTypeIds]);

  // useEffect(() => {
  //   if (user.profile.toUpperCase() === "ADMIN") {
  //     setShowAll(true);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    (async () => {
      try {
        // TRAEMOS TODAS LAS CATEGORIAS
        const { data } = await api.get("/categories?markByUserQueue=true");

        // OBTENEMOS EL ORDEN GUARDADO POR EL USUARIO EN EL LOCAL STORAGE
        const categoriesOrder =
          JSON.parse(localStorage.getItem("categoriesOrder")) || [];

        // ORDENAMOS LAS CATEGORIAS CON EL ORDEN GUARDADO EN EL LOCAL STORAGE
        // SI NO HAY ORDEN GUARDADO, LAS CATEGORIAS SE ORDENAN ALFABETICAMENTE
        const sortedCategories = ["no-category", ...data].sort((a, b) => {
          const indexA = categoriesOrder.indexOf(a.id || a);
          const indexB = categoriesOrder.indexOf(b.id || b);

          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }

          if (indexA === -1) return 1;
          if (indexB === -1) return -1;

          return 0;
        });

        console.log("sortedCategories", sortedCategories);

        // SETEAMOS LAS CATEGORIAS EN EL ESTADO
        setCategories(sortedCategories);

        // OBTENEMOS EL ID DE CATEGORIAS SELECCIONADAS DEL LOCAL STORAGE
        let selectedCategoriesIds = JSON.parse(
          localStorage.getItem("selectedCategoriesIds")
        );

        if (selectedCategoriesIds) {
          // FILTRAMOS LO GUARDADO PARA QUE COINCIDA CON LO QUE NOS DEVUELVE EL BACKEND
          selectedCategoriesIds = selectedCategoriesIds.filter(
            (selectedCategoryId) =>
              data.find((category) => category.id === selectedCategoryId) ||
              selectedCategoryId === "no-category"
          );
          localStorage.setItem(
            "selectedCategoriesIds",
            JSON.stringify(selectedCategoriesIds)
          );
        } else {
          // SI NO HAY CATEGORIAS SELECCIONADAS EN EL LOCAL STORAGE, SE SETEA UN ARRAY VACIO
          localStorage.setItem("selectedCategoriesIds", JSON.stringify([]));
          selectedCategoriesIds = [];
        }

        // SETEAMOS LAS CATEGORIAS SELECCIONADAS EN EL ESTADO
        setSelectedCategoriesIds(selectedCategoriesIds);

        console.log("selectedCategoriesIds", selectedCategoriesIds);
      } catch (error) {
        toast.error("Error al cargar las categorias");
        console.log("Error al cargar las categorias - ", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
      setSearchParam("");
      setNumberGroups([]);
    }
  }, [tab]);

  useEffect(() => {
    async function getNumberGroups() {
      try {
        const { data } = await api.get(`/getNumberGroups/${searchParam}`);
        console.log("getNumberContacts -> data", data);
        setNumberGroups(data.registerGroups);
      } catch (err) {
        console.log("err", err);
        // toastError(err);
      }
    }

    if (searchParam && /^\d+$/.test(searchParam) && tab === "search") {
      console.log("se dispara la busqueda: ", /^\d+$/.test(searchParam));

      getNumberGroups();
    }
  }, [searchParam]);

  useEffect(() => {
      const notificationsInterval = setInterval(async () => {
        const notificationsCount = await api.get("/notifications/getNotificationsCountForUser")

        setNotificationsCount(notificationsCount.data.count);
      }, 5000);
      return () => clearInterval(notificationsInterval);
    }, [whatsApps]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    // if (searchedTerm === "") {
    //   // setSearchParam(searchedTerm);
    //   // setTab("open");
    //   return;
    // }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 250);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const onMoveSecondaryColumn = (direction) => {
    if (direction === secondaryColumnSide) return;

    setSecondaryColumnSide(direction);
    localStorage.setItem("secondaryColumnSide", JSON.stringify(direction));
  };

  const onMovePendingColumn = (direction) => {
    if (direction === pendingColumnSide) return;

    setPendingColumnSide(direction);
    localStorage.setItem("pendingColumnSide", JSON.stringify(direction));
  };

  const onMoveCategoryColumn = (oldIndex, direction) => {
    const newCategories = [...categories];

    if (direction === "left") {
      if (oldIndex === 0) return; // Si ya está en la posición más alta, no hacer nada
      const elemento = newCategories.splice(oldIndex, 1)[0];
      newCategories.splice(oldIndex - 1, 0, elemento);
    } else {
      if (oldIndex === newCategories.length - 1) return; // Si ya está en la posición más baja, no hacer nada
      const elemento = newCategories.splice(oldIndex, 1)[0];
      newCategories.splice(oldIndex + 1, 0, elemento);
    }

    const categoryIds = newCategories.map(
      (category) => category.id || "no-category"
    );

    localStorage.setItem("categoriesOrder", JSON.stringify(categoryIds));

    console.log("newCategories", newCategories);

    setCategories(newCategories);
  };

  const onSelectTicketsCountChips = (selectedEtapa) => {
    setSelectedClientelicenciaEtapaIds(e => {
      if (e.includes(selectedEtapa)) {
        return e.filter(id => id !== selectedEtapa);
      }
      return [...e, selectedEtapa];
    })
  }

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(e) => setNewTicketModalOpen(false)}
      />

      {/* TABS */}
      <Paper elevation={1} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >

          {/* Panel */}
          <Tab
            value={"general"}
            icon={<HomeIcon style={{ fontSize: 21 }} />}
            label={"General"}
            classes={{ root: classes.tab }}
          />
          {/* - Panel */}

          {/* open */}
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon style={{ fontSize: 21 }} />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          {/* - open */}

          {/* Notifications */}
          <Tab
            value={"notifications"}
            icon={
              <Badge
                overlap="rectangular"
                badgeContent={notificationsCount !== null ? notificationsCount : 0}
                color="error"
              >
                <NotificationsIcon style={{ fontSize: 21 }} />
              </Badge>
            }
            label={"Notificaciones"}
            classes={{ root: classes.tab }}
          />
          {/* - Notifications */}

          {/* closed */}
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon style={{ fontSize: 21 }} />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab }}
          />
          {/* - closed */}

          {/* search */}
          {/* <Tab
            value={"search"}
            icon={<SearchIcon style={{ fontSize: 21 }} />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          /> */}
          {/* - search */}
        </Tabs>

        <div className={classes.ticketOptionsBox}>
          {/* {tab === "search" ? ( */}
          <>
            {/* // SEARCH INPUT */}
            <div className={classes.serachInputWrapper}>
              <SearchIcon className={classes.searchIcon} />
              <InputBase
                className={classes.searchInput}
                inputRef={searchInputRef}
                placeholder="Buscar tickets"
                type="search"
                onChange={handleSearch}
              />
            </div>
            {/* - SEARCH INPUT */}
          </>
          {/* ) : ( */}
          <>
            {/* ADD TICKECT BUTTON */}
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setNewTicketModalOpen(true)}
            >
              {i18n.t("ticketsManager.buttons.newTicket")}
            </Button>
            {/* - ADD TICKECT BUTTON */}

            {/* SHOW ALL TICKETS SWITCH */}   
            {/* <Can
              role={user.profile}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() =>
                        setShowAllTickets((prevState) => !prevState)
                      }
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              )}
            /> */}
            {/* - SHOW ALL TICKETS SWITCH */}
          </>
          {/* )} */}
          {/* WPP SELECT */}
          {user.profile === "admin" && (
            <TicketsWhatsappSelect
              style={{ marginLeft: 6 }}
              selectedWhatsappIds={selectedWhatsappIds || []}
              userWhatsapps={whatsApps || []}
              onChange={(values) => setSelectedWhatsappIds(values)}
            />
          )}
          {/* - WPP SELECT */}
          {/* QUEUE SELECT */}
          <TicketsQueueSelect
            style={{ marginLeft: 6 }}
            selectedQueueIds={selectedQueueIds}
            userQueues={user?.queues}
            onChange={(values) => setSelectedQueueIds(values)}
          />
          {/* - QUEUE SELECT */}
          {/* USER SELECT */}
          <UsersSelect
            selectedIds={selectedTicketUsersIds}
            onChange={(values) => {
              localStorage.setItem(
                "TicketUsersIds",
                JSON.stringify(values)
              );
              setSelectedTicketUsersIds(values);
            }}
            chips={false}
            badgeColor={"secondary"}
          />
          {/* - USER SELECT */}
          {/* MARKETING CAMPAIGN SELECT */}
          {getREACT_APP_PURPOSE() === "comercial" && (
            <MarketingCampaignSelect
              style={{ marginLeft: 6 }}
              selectedIds={selectedMarketingCampaignIds} // corrected prop name
              onChange={(values) => {
                localStorage.setItem(
                  "ticketsPanel-selectedMarketingCampaignIds",
                  JSON.stringify(values)
                );
                setSelectedMarketingCampaignIds(values);
              }} // corrected setter
              chips={false}
              badgeColor={"secondary"}
            />
          )}
          {/* - MARKETING CAMPAIGN SELECT */}
          {tab === "search" && (
            <>
              <Badge
                overlap="rectangular"
                badgeContent={numberGroups.length}
                className={classes.badge}
                color="primary"
                max={99999}
                invisible={numberGroups.length === 0}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    setNumberGroupsModalIsOpen(true);
                  }}
                  // style={{ position: "relative", left: "-5px" }}
                  style={{ marginRight: "5px" }}
                >
                  <PeopleOutlineIcon fontSize="large" />
                </IconButton>
              </Badge>

              <NumberGroupsModal
                modalOpen={numberGroupsModalIsOpen}
                onClose={() => setNumberGroupsModalIsOpen(false)}
                number={searchParam}
                groups={numberGroups}
              />
            </>
          )}
          <Divider
            flexItem
            orientation="vertical"
            style={{ marginLeft: 20, marginRight: 20 }}
          />
          <ToggleButtonGroup
            value={columnsWidth}
            exclusive
            onChange={(e, newValue) => {
              setColumnsWidth(newValue);
              localStorage.setItem(
                "TicketsManager-columnsWidth",
                JSON.stringify(newValue)
              );
            }}
            aria-label="text alignment"
            size="small"
          >
            <ToggleButton value="normal" size="small" aria-label="left aligned">
              <ViewColumnIcon />
            </ToggleButton>
            <ToggleButton value="large" size="small" aria-label="centered">
              <ViewWeekIcon />
            </ToggleButton>
          </ToggleButtonGroup>
          {/* <Divider
            flexItem
            orientation="vertical"
            style={{ marginLeft: 20, marginRight: 20 }}
          /> */}
          N° Filas:
          <ToggleButtonGroup
            value={doubleRow}
            exclusive
            onChange={(e, newValue) => {
              setDoubleRow(newValue);
              localStorage.setItem(
                "TicketsManager-doubleRow",
                JSON.stringify(newValue)
              );
            }}
            aria-label="text alignment"
            size="small"
          >
            <ToggleButton value={false} size="small" aria-label="left aligned">
              {" "}
              1{" "}
            </ToggleButton>
            <ToggleButton value={true} size="small" aria-label="centered">
              {" "}
              2{" "}
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
      </Paper>
      {/* - TABS */}

      {/* INBOX TAB CONTENT  */}
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        {/* TABS CONTENT */}
        <Paper
          className={classes.ticketsWrapper}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "16 0",
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 0px",
            }}
          >
            {tab === "open" && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    padding: "0px 16px 0px",
                    fontSize: 12
                  }}
                >
                  <div>
                    DIV -{" "}
                    {principalTicketType === "groups"
                      ? "GRUP"
                      : "INDIV"}
                  </div>
                  <ArrowDropDownIcon
                    fontSize="medium"
                    style={{
                      cursor: "pointer",
                      scale: "1.5",
                    }}
                    onClick={(e) => {
                      setAnchorEl2(e.currentTarget);
                    }}
                  />

                  <Menu
                    anchorEl={anchorEl2}
                    open={Boolean(anchorEl2)}
                    onClose={() => setAnchorEl2(null)}
                  >
                    <MenuItem
                      onClick={() => {
                        localStorage.setItem(
                          "principalTicketType",
                          JSON.stringify("individuals")
                        );
                        setPrincipalTicketType("individuals");
                        setAnchorEl2(null);
                      }}
                    >
                      Chats individuales
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        localStorage.setItem(
                          "principalTicketType",
                          JSON.stringify("groups")
                        );
                        setPrincipalTicketType("groups");
                        setAnchorEl2(null);
                      }}
                    >
                      Chats grupales
                    </MenuItem>
                  </Menu>
                </div>
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginLeft: "auto",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Sin Etapa"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={sinEtapaChipValueId}
                onClick={() => {onSelectTicketsCountChips(null)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Onboarding"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={onboardingChipValueId}
                onClick={() => {onSelectTicketsCountChips(6)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Insp. tecnica"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={inspTecnicaChipValueId}
                onClick={() => {onSelectTicketsCountChips(1)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Config. plataforma"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={configPlataformaChipValueId}
                onClick={() => {onSelectTicketsCountChips(2)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Config. equipos"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={configEquiposChipValueId}
                onClick={() => {onSelectTicketsCountChips(3)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Cap. op y mantenimiento"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={capOpYMonitoreoChipValueId}
                onClick={() => {onSelectTicketsCountChips(4)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Monitoreo"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={monitoreoChipValueId}
                onClick={() => {onSelectTicketsCountChips(8)}}
              />
              <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Alta"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={altaChipValueId}
                onClick={() => {onSelectTicketsCountChips(5)}}
              />
              {/* <TicketsCountChips
                status="open"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForGroups}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                chipLabel="Alta FE"
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                clientelicenciaEtapaIds={altaFeChipValueId}
                onClick={() => {onSelectTicketsCountChips(7)}}
              /> */}
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginLeft: "auto",
                fontSize: 12
              }}
            >
              {/* SELECTOR DE MIOS O TODOS */}
              <Can
                role={user.profile}
                perform="tickets-manager:showall"
                yes={() => (
                  <>
                    {tab === "open" && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          marginLeft: "auto",
                          padding: "0px 16px 0px",
                        }}
                      >
                        <div>
                          {principalTicketType === "groups"
                            ? "GRUP"
                            : "INDIV"}{" "}
                          -{" "}
                          {/* {principalTicketType === "groups"
                            ? showAll
                              ? "TODOS"
                              : "MÍOS"
                            : showOnlyMyGroups
                            ? "PARTICIPANDO"
                            : "TODOS"} */}
                          {principalTicketType === "groups"
                            ? showOnlyMyGroups
                              ? "PART"
                              : "TODS"
                            : showAll
                            ? "TODS"
                            : "MÍOS"}
                        </div>
                        <ArrowDropDownIcon
                          fontSize="medium"
                          style={{
                            cursor: "pointer",
                            scale: "1.5",
                          }}
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                          }}
                        />

                        <Menu
                          anchorEl={anchorEl}
                          open={Boolean(anchorEl)}
                          onClose={() => {
                            setAnchorEl(null);
                          }}
                        >
                          <MenuItem
                            onClick={(e) => {
                              if (principalTicketType === "groups") {
                                localStorage.setItem(
                                  "showOnlyMyGroups",
                                  JSON.stringify(false)
                                );
                                setShowOnlyMyGroups(false);
                              } else {
                                localStorage.setItem(
                                  "showAll",
                                  JSON.stringify(true)
                                );
                                setShowAll(true);
                              }

                              setAnchorEl(null);
                            }}
                          >
                            {principalTicketType === "groups"
                              ? "Todos los grupos"
                              : "Todos los tickets"}
                          </MenuItem>
                          <MenuItem
                            onClick={(e) => {
                              if (principalTicketType === "groups") {
                                localStorage.setItem(
                                  "showOnlyMyGroups",
                                  JSON.stringify(true)
                                );
                                setShowOnlyMyGroups(true);
                              } else {
                                localStorage.setItem(
                                  "showAll",
                                  JSON.stringify(false)
                                );
                                setShowAll(false);
                              }

                              setAnchorEl(null);
                            }}
                          >
                            {principalTicketType === "groups"
                              ? "En los que participo"
                              : "Mis tickets"}
                          </MenuItem>
                        </Menu>
                      </div>
                    )}
                  </>
                )}
                no={() =>
                  principalTicketType === "groups" ? (
                    <>
                      {tab === "open" && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            marginLeft: "auto",
                            padding: "0px 16px 0px",
                          }}
                        >
                          <div>
                            GRUPOS -{" "}
                            {showOnlyMyGroups ? "PARTICIPANDO" : "TODOS"}
                          </div>
                          <ArrowDropDownIcon
                            fontSize="medium"
                            style={{
                              cursor: "pointer",
                              scale: "1.5",
                            }}
                            onClick={(e) => {
                              setAnchorEl(e.currentTarget);
                            }}
                          />

                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={() => {
                              setAnchorEl(null);
                            }}
                          >
                            <MenuItem
                              onClick={(e) => {
                                if (principalTicketType === "groups") {
                                  localStorage.setItem(
                                    "showOnlyMyGroups",
                                    JSON.stringify(false)
                                  );
                                  setShowOnlyMyGroups(false);
                                }
                                setAnchorEl(null);
                              }}
                            >
                              Todos los grupos
                            </MenuItem>
                            <MenuItem
                              onClick={(e) => {
                                if (principalTicketType === "groups") {
                                  localStorage.setItem(
                                    "showOnlyMyGroups",
                                    JSON.stringify(true)
                                  );
                                  setShowOnlyMyGroups(true);
                                }
                                setAnchorEl(null);
                              }}
                            >
                              En los que participo
                            </MenuItem>
                          </Menu>
                        </div>
                      )}
                    </>
                  ) : null
                }
              />
              {/* - SELECTOR DE MIOS O TODOS */}

              {/* SELECTOR DE CATEGORIAS */}
              <Badge
                overlap="rectangular"
                badgeContent={selectedCategoriesIds?.length}
                max={99999}
                color="secondary"
                invisible={selectedCategoriesIds?.length === 0}
                className="TicketsWhatsappSelect"
              >
                <div style={{}}>
                  <FormControl>
                    <Select
                      multiple
                      displayEmpty
                      variant="outlined"
                      value={selectedCategoriesIds}
                      onChange={(e) => {
                        console.log("e.target.value", e.target.value);
                        localStorage.setItem(
                          "selectedCategoriesIds",
                          JSON.stringify(e.target.value)
                        );
                        setSelectedCategoriesIds(e.target.value);
                      }}
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
                      renderValue={() => "Categorias"}
                    >
                      {categories?.length > 0 &&
                        categories
                          .filter(
                            (c) => c.userHasThisCategory || c === "no-category"
                          )
                          .map((category) => (
                            <MenuItem
                              dense
                              key={category.id || category}
                              value={category.id || category}
                            >
                              <Checkbox
                                style={{
                                  color: "black",
                                }}
                                size="small"
                                color="primary"
                                checked={
                                  selectedCategoriesIds.indexOf(
                                    category.id || category
                                  ) >= 0
                                }
                              />
                              <ListItemText
                                primary={category.name || category}
                              />
                            </MenuItem>
                          ))}
                    </Select>
                  </FormControl>
                </div>
              </Badge>
              {/* - SELECTOR DE CATEGORIAS */}

              <Divider
                flexItem
                orientation="vertical"
                style={{ marginLeft: 20, marginRight: 20 }}
              />

              {/* FILTRO DE RESPUESTA */}
              <FormControlLabel
                id="showOnlyWaitingTicketsLabel"
                style={{ marginRight: 7, color: "gray", marginLeft: 0 }}
                label={"Solo sin respuesta"}
                labelPlacement="start"
                control={
                  <Switch
                    size="small"
                    checked={showOnlyWaitingTickets}
                    onChange={(e) => {
                      setShowOnlyWaitingTickets(e.target.checked);
                      localStorage.setItem(
                        "TicketsManager-showOnlyWaitingTickets",
                        JSON.stringify(e.target.checked)
                      );
                    }}
                    name="showOnlyWaitingTickets"
                    color="primary"
                  />
                }
              />
              {/* - FILTRO DE RESPUESTA */}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 12,
              padding: "16px 16px 16px",
              overflow: "auto",
              flexGrow: 1,
            }}
          >
            <TicketsList
              status="open"
              searchParam={searchParam}
              showAll={showAll}
              setShowAll={setShowAll}
              showOnlyMyGroups={showOnlyMyGroups}
              setShowOnlyMyGroups={setShowOnlyMyGroups}
              showOnlyWaitingTickets={showOnlyWaitingTickets}
              columnsWidth={columnsWidth}
              selectedTypeIds={
                principalTicketType === "groups"
                  ? typeIdsForIndividuals
                  : typeIdsForGroups
              }
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              selectedTicketUsersIds={selectedTicketUsersIds}
              selectedMarketingCampaignIds={selectedMarketingCampaignIds}
              ticketsType={
                principalTicketType === "groups" ? "individuals" : "groups"
              }
              onMoveToLeft={() => onMoveSecondaryColumn("left")}
              onMoveToRight={() => {
                onMoveSecondaryColumn("right");
              }}
              style={{
                ...(secondaryColumnSide === "left"
                  ? { order: 0 }
                  : { order: 2 }),
              }}
              selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
            />

            <TicketsList
              status="pending"
              searchParam={searchParam}
              selectedTypeIds={typeIdsForAll}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              // selectedTicketUsersIds={selectedTic  ketUsersIds}
              selectedMarketingCampaignIds={selectedMarketingCampaignIds}
              showOnlyWaitingTickets={showOnlyWaitingTickets}
              columnsWidth={columnsWidth}
              ticketsType="pendings"
              onMoveToLeft={() => onMovePendingColumn("left")}
              onMoveToRight={() => {
                onMovePendingColumn("right");
              }}
              style={{
                ...(pendingColumnSide === "left" ? { order: 0 } : { order: 1 }),
              }}
            />

            {/* <Divider orientation="vertical" flexItem /> */}

            {(secondaryColumnSide === "left" ||
              pendingColumnSide === "left") && (
              <Divider orientation="vertical" flexItem />
            )}

            {(() => {
              if (doubleRow) {
                return (
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": `repeat(${Math.round(
                        selectedCategoriesIds?.length / 2
                      )}, 1fr)`,
                      gap: "12px",
                      height: "100%",
                      "grid-auto-flow": "column",
                      "grid-template-rows": "repeat(2, auto)",
                    }}
                  >
                    {categories.map((category, categoryIndex) => {
                      return category === "no-category" ? (
                        <TicketsList
                          key="no-category"
                          status="open"
                          searchParam={searchParam}
                          showAll={showAll}
                          showOnlyMyGroups={showOnlyMyGroups}
                          selectedTypeIds={
                            principalTicketType === "groups"
                              ? typeIdsForGroups
                              : typeIdsForIndividuals
                          }
                          selectedWhatsappIds={selectedWhatsappIds}
                          selectedQueueIds={selectedQueueIds}
                          selectedTicketUsersIds={selectedTicketUsersIds}
                          selectedMarketingCampaignIds={
                            selectedMarketingCampaignIds
                          }
                          showOnlyWaitingTickets={showOnlyWaitingTickets}
                          columnsWidth={columnsWidth}
                          ticketsType="no-category"
                          onMoveToLeft={() =>
                            onMoveCategoryColumn(categoryIndex, "left")
                          }
                          onMoveToRight={() => {
                            onMoveCategoryColumn(categoryIndex, "right");
                          }}
                          selectedCategoriesIds={selectedCategoriesIds}
                          selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                        />
                      ) : (
                        <TicketsList
                          key={category.id}
                          status="open"
                          searchParam={searchParam}
                          category={category}
                          showAll={showAll}
                          showOnlyMyGroups={showOnlyMyGroups}
                          showOnlyWaitingTickets={showOnlyWaitingTickets}
                          columnsWidth={columnsWidth}
                          selectedTypeIds={
                            principalTicketType === "groups"
                              ? typeIdsForGroups
                              : typeIdsForIndividuals
                          }
                          selectedWhatsappIds={selectedWhatsappIds}
                          selectedQueueIds={selectedQueueIds}
                          selectedTicketUsersIds={selectedTicketUsersIds}
                          selectedMarketingCampaignIds={
                            selectedMarketingCampaignIds
                          }
                          onMoveToLeft={() =>
                            onMoveCategoryColumn(categoryIndex, "left")
                          }
                          onMoveToRight={() => {
                            onMoveCategoryColumn(categoryIndex, "right");
                          }}
                          selectedCategoriesIds={selectedCategoriesIds}
                          selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                        />
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <>
                    {categories.map((category, categoryIndex) => {
                      return category === "no-category" ? (
                        <TicketsList
                          key="no-category"
                          status="open"
                          searchParam={searchParam}
                          showAll={showAll}
                          showOnlyMyGroups={showOnlyMyGroups}
                          selectedTypeIds={
                            principalTicketType === "groups"
                              ? typeIdsForGroups
                              : typeIdsForIndividuals
                          }
                          selectedWhatsappIds={selectedWhatsappIds}
                          selectedQueueIds={selectedQueueIds}
                          selectedTicketUsersIds={selectedTicketUsersIds}
                          selectedMarketingCampaignIds={
                            selectedMarketingCampaignIds
                          }
                          showOnlyWaitingTickets={showOnlyWaitingTickets}
                          columnsWidth={columnsWidth}
                          ticketsType="no-category"
                          onMoveToLeft={() =>
                            onMoveCategoryColumn(categoryIndex, "left")
                          }
                          onMoveToRight={() => {
                            onMoveCategoryColumn(categoryIndex, "right");
                          }}
                          selectedCategoriesIds={selectedCategoriesIds}
                          selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                        />
                      ) : (
                        <TicketsList
                          key={category.id}
                          status="open"
                          searchParam={searchParam}
                          category={category}
                          showAll={showAll}
                          showOnlyMyGroups={showOnlyMyGroups}
                          showOnlyWaitingTickets={showOnlyWaitingTickets}
                          columnsWidth={columnsWidth}
                          selectedTypeIds={
                            principalTicketType === "groups"
                              ? typeIdsForGroups
                              : typeIdsForIndividuals
                          }
                          selectedWhatsappIds={selectedWhatsappIds}
                          selectedQueueIds={selectedQueueIds}
                          selectedTicketUsersIds={selectedTicketUsersIds}
                          selectedMarketingCampaignIds={
                            selectedMarketingCampaignIds
                          }
                          onMoveToLeft={() =>
                            onMoveCategoryColumn(categoryIndex, "left")
                          }
                          onMoveToRight={() => {
                            onMoveCategoryColumn(categoryIndex, "right");
                          }}
                          selectedCategoriesIds={selectedCategoriesIds}
                          selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                        />
                      );
                    })}
                  </>
                );
              }
            })()}

            {(secondaryColumnSide === "right" ||
              pendingColumnSide === "right") && (
              <Divider orientation="vertical" flexItem />
            )}
          </div>
        </Paper>
        {/* - TABS CONTENT */}
      </TabPanel>
      {/* - INBOX TAB CONTENT  */}

      {/* closed TAB CONTENT */}
      <TabPanel
        value={tab}
        name="closed"
        className={classes.ticketsWrapper}
        style={{
          padding: "16 0",
        }}
      >
        <TicketsList
          status="closed"
          searchParam={searchParam}
          // showAll={true}
          selectedTypeIds={typeIdsForAll}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedQueueIds={selectedQueueIds}
          selectedTicketUsersIds={selectedTicketUsersIds}
          selectedMarketingCampaignIds={selectedMarketingCampaignIds}
          columnsWidth={columnsWidth}
        />
      </TabPanel>
      {/* - closed TAB CONTENT */}

      {/* notifications TAB CONTENT */}
      <TabPanel
        value={tab}
        name="notifications"
        className={classes.ticketsWrapper}
      >
        <Paper
          className={classes.ticketsWrapper}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "16 0",
            overflow: "auto",
          }}
        >

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 0px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginLeft: "auto",
              }}
            >

              {user.profile === "admin" && (
                <>
                  <UsersSelect
                    selectedIds={selectedUsersIds}
                    onChange={(values) => {
                      localStorage.setItem(
                        "NotificationsUsersIds",
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
            </div>
          </div>
          
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 12,
              padding: "16px 16px 16px",
              overflow: "auto",
              flexGrow: 1,
            }}
          >
            <NotificationsList
              searchParam={searchParam}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              selectedTicketUsersIds={selectedTicketUsersIds}
              selectedUsersIds={user.profile === "admin" ? selectedUsersIds : currentUserId}
            />
          </div>
        </Paper>
      </TabPanel>
      {/* - notifications TAB CONTENT */}

      {/* general TAB CONTENT */}
      <TabPanel value={tab} name="general" className={classes.ticketsWrapper}>
        {/* TABS CONTENT */}
          <Paper
            className={classes.ticketsWrapper}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "16 0",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px 0px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  padding: "0px 16px 0px",
                  fontSize: 12
                }}
              >
                <FormControl
                  fullWidth
                  margin="dense"
                  variant="outlined"
                  style={{width: "10rem"}}
                >
                  <InputLabel id="principalTicketTypeForGeneralView-label">
                    Tipo de Ticket
                  </InputLabel>
                  <Select
                    labelId="principalTicketTypeForGeneralView-label"
                    value={principalTicketTypeForGeneralView}
                    onChange={(e) => {
                      setPrincipalTicketTypeForGeneralView(e.target.value);
                    }}
                    label="Tipo de Ticket"
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="individuals">Individuales</MenuItem>
                    <MenuItem value="groups">Grupales</MenuItem>
                  </Select>
                </FormControl>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: "auto",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Sin Etapa"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={sinEtapaChipValueId}
                  onClick={() => {onSelectTicketsCountChips(null)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Onboarding"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={onboardingChipValueId}
                  onClick={() => {onSelectTicketsCountChips(6)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Insp. tecnica"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={inspTecnicaChipValueId}
                  onClick={() => {onSelectTicketsCountChips(1)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Config. plataforma"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={configPlataformaChipValueId}
                  onClick={() => {onSelectTicketsCountChips(2)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Config. equipos"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={configEquiposChipValueId}
                  onClick={() => {onSelectTicketsCountChips(3)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Cap. op y mantenimiento"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={capOpYMonitoreoChipValueId}
                  onClick={() => {onSelectTicketsCountChips(4)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Monitoreo"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={monitoreoChipValueId}
                  onClick={() => {onSelectTicketsCountChips(8)}}
                />
                <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedTicketUsersIds={selectedTicketUsersIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Alta"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={altaChipValueId}
                  onClick={() => {onSelectTicketsCountChips(5)}}
                />
                {/* <TicketsCountChips
                  status="open"
                  searchParam={searchParam}
                  selectedTypeIds={typeIdsForGroups}
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                  chipLabel="Alta FE"
                  selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                  clientelicenciaEtapaIds={altaFeChipValueId}
                  onClick={() => {onSelectTicketsCountChips(7)}}
                /> */}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: "auto",
                  fontSize: 12
                }}
              >
                {/* SELECTOR DE MIOS O TODOS */}
                <Can
                  role={user.profile}
                  perform="tickets-manager:showall"
                  yes={() => (
                    <>
                      {tab === "open" && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            marginLeft: "auto",
                            padding: "0px 16px 0px",
                          }}
                        >
                          <div>
                            {principalTicketType === "groups"
                              ? "GRUP"
                              : "INDIV"}{" "}
                            -{" "}
                            {/* {principalTicketType === "groups"
                              ? showAll
                                ? "TODOS"
                                : "MÍOS"
                              : showOnlyMyGroups
                              ? "PARTICIPANDO"
                              : "TODOS"} */}
                            {principalTicketType === "groups"
                              ? showOnlyMyGroups
                                ? "PART"
                                : "TODS"
                              : showAll
                              ? "TODS"
                              : "MÍOS"}
                          </div>
                          <ArrowDropDownIcon
                            fontSize="medium"
                            style={{
                              cursor: "pointer",
                              scale: "1.5",
                            }}
                            onClick={(e) => {
                              setAnchorEl(e.currentTarget);
                            }}
                          />

                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={() => {
                              setAnchorEl(null);
                            }}
                          >
                            <MenuItem
                              onClick={(e) => {
                                if (principalTicketType === "groups") {
                                  localStorage.setItem(
                                    "showOnlyMyGroups",
                                    JSON.stringify(false)
                                  );
                                  setShowOnlyMyGroups(false);
                                } else {
                                  localStorage.setItem(
                                    "showAll",
                                    JSON.stringify(true)
                                  );
                                  setShowAll(true);
                                }

                                setAnchorEl(null);
                              }}
                            >
                              {principalTicketType === "groups"
                                ? "Todos los grupos"
                                : "Todos los tickets"}
                            </MenuItem>
                            <MenuItem
                              onClick={(e) => {
                                if (principalTicketType === "groups") {
                                  localStorage.setItem(
                                    "showOnlyMyGroups",
                                    JSON.stringify(true)
                                  );
                                  setShowOnlyMyGroups(true);
                                } else {
                                  localStorage.setItem(
                                    "showAll",
                                    JSON.stringify(false)
                                  );
                                  setShowAll(false);
                                }

                                setAnchorEl(null);
                              }}
                            >
                              {principalTicketType === "groups"
                                ? "En los que participo"
                                : "Mis tickets"}
                            </MenuItem>
                          </Menu>
                        </div>
                      )}
                    </>
                  )}
                  no={() =>
                    principalTicketType === "groups" ? (
                      <>
                        {tab === "open" && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                              marginLeft: "auto",
                              padding: "0px 16px 0px",
                            }}
                          >
                            <div>
                              GRUPOS -{" "}
                              {showOnlyMyGroups ? "PARTICIPANDO" : "TODOS"}
                            </div>
                            <ArrowDropDownIcon
                              fontSize="medium"
                              style={{
                                cursor: "pointer",
                                scale: "1.5",
                              }}
                              onClick={(e) => {
                                setAnchorEl(e.currentTarget);
                              }}
                            />

                            <Menu
                              anchorEl={anchorEl}
                              open={Boolean(anchorEl)}
                              onClose={() => {
                                setAnchorEl(null);
                              }}
                            >
                              <MenuItem
                                onClick={(e) => {
                                  if (principalTicketType === "groups") {
                                    localStorage.setItem(
                                      "showOnlyMyGroups",
                                      JSON.stringify(false)
                                    );
                                    setShowOnlyMyGroups(false);
                                  }
                                  setAnchorEl(null);
                                }}
                              >
                                Todos los grupos
                              </MenuItem>
                              <MenuItem
                                onClick={(e) => {
                                  if (principalTicketType === "groups") {
                                    localStorage.setItem(
                                      "showOnlyMyGroups",
                                      JSON.stringify(true)
                                    );
                                    setShowOnlyMyGroups(true);
                                  }
                                  setAnchorEl(null);
                                }}
                              >
                                En los que participo
                              </MenuItem>
                            </Menu>
                          </div>
                        )}
                      </>
                    ) : null
                  }
                />
                {/* - SELECTOR DE MIOS O TODOS */}

                {/* SELECTOR DE CATEGORIAS */}
                {/* <Badge
                  overlap="rectangular"
                  badgeContent={selectedCategoriesIds?.length}
                  max={99999}
                  color="secondary"
                  invisible={selectedCategoriesIds?.length === 0}
                  className="TicketsWhatsappSelect"
                >
                  <div style={{}}>
                    <FormControl>
                      <Select
                        multiple
                        displayEmpty
                        variant="outlined"
                        value={selectedCategoriesIds}
                        onChange={(e) => {
                          console.log("e.target.value", e.target.value);
                          localStorage.setItem(
                            "selectedCategoriesIds",
                            JSON.stringify(e.target.value)
                          );
                          setSelectedCategoriesIds(e.target.value);
                        }}
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
                        renderValue={() => "Categorias"}
                      >
                        {categories?.length > 0 &&
                          categories
                            .filter(
                              (c) => c.userHasThisCategory || c === "no-category"
                            )
                            .map((category) => (
                              <MenuItem
                                dense
                                key={category.id || category}
                                value={category.id || category}
                              >
                                <Checkbox
                                  style={{
                                    color: "black",
                                  }}
                                  size="small"
                                  color="primary"
                                  checked={
                                    selectedCategoriesIds.indexOf(
                                      category.id || category
                                    ) >= 0
                                  }
                                />
                                <ListItemText
                                  primary={category.name || category}
                                />
                              </MenuItem>
                            ))}
                      </Select>
                    </FormControl>
                  </div>
                </Badge> */}
                {/* - SELECTOR DE CATEGORIAS */}

                <Divider
                  flexItem
                  orientation="vertical"
                  style={{ marginLeft: 20, marginRight: 20 }}
                />

                {/* FILTRO DE RESPUESTA */}
                <FormControlLabel
                  id="showOnlyWaitingTicketsLabel"
                  style={{ marginRight: 7, color: "gray", marginLeft: 0 }}
                  label={"Solo sin respuesta"}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showOnlyWaitingTickets}
                      onChange={(e) => {
                        setShowOnlyWaitingTickets(e.target.checked);
                        localStorage.setItem(
                          "TicketsManager-showOnlyWaitingTickets",
                          JSON.stringify(e.target.checked)
                        );
                      }}
                      name="showOnlyWaitingTickets"
                      color="primary"
                    />
                  }
                />
                {/* - FILTRO DE RESPUESTA */}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 12,
                padding: "16px 16px 16px",
                overflow: "auto",
                flexGrow: 1,
              }}
            >
              <TicketsList
                searchParam={searchParam}
                selectedTypeIds={
                  principalTicketTypeForGeneralView === "all"
                    ? typeIdsForAll
                    : principalTicketTypeForGeneralView === "groups"
                      ? typeIdsForGroups
                      : typeIdsForIndividuals
                }
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                showOnlyWaitingTickets={showOnlyWaitingTickets}
                ticketsType={"no-response"}
                advancedList={"no-response"}
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                showAll={true}
                showOnlyMyGroups={false}
              />

              <TicketsList
                searchParam={searchParam}
                selectedTypeIds={
                  principalTicketTypeForGeneralView === "all"
                    ? typeIdsForAll
                    : principalTicketTypeForGeneralView === "groups"
                      ? typeIdsForGroups
                      : typeIdsForIndividuals
                }
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                showOnlyWaitingTickets={showOnlyWaitingTickets}
                ticketsType={"in-progress"}
                advancedList={"in-progress"}
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                showAll={true}
                showOnlyMyGroups={false}
              />

              {/* <TicketsList
                status="pending"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForAll}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                showOnlyWaitingTickets={showOnlyWaitingTickets}
              /> */}

              <TicketsList
                status="closed"
                searchParam={searchParam}
                selectedTypeIds={typeIdsForAll}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                selectedTicketUsersIds={selectedTicketUsersIds}
                selectedMarketingCampaignIds={selectedMarketingCampaignIds}
                selectedClientelicenciaEtapaIds={selectedClientelicenciaEtapaIds}
                showAll={true}
                showOnlyMyGroups={false}
              />

            </div>
          </Paper>
        {/* - TABS CONTENT */}
      </TabPanel>
      {/* - general TAB CONTENT */}

      {/* search TAB CONTENT */}
      {/* <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          selectedTypeIds={typeIdsForAll}
          selectedWhatsappIds={user.profile === "admin"  ? selectedWhatsappIds : []}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel> */}
      {/* - search TAB CONTENT */}
    </Paper>
  );
};

export default TicketsManager;
