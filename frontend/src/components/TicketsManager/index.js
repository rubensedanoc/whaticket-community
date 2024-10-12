import React, { useContext, useEffect, useRef, useState } from "react";

import Badge from "@material-ui/core/Badge";
import InputBase from "@material-ui/core/InputBase";
import Paper from "@material-ui/core/Paper";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import SearchIcon from "@material-ui/icons/Search";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

import { IconButton } from "@material-ui/core";
import NumberGroupsModal from "../NumberGroupsModal";
import TicketsWhatsappSelect from "../TicketsWhatsappSelect";

import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import { Can } from "../Can";
import NewTicketModal from "../NewTicketModal";
import TabPanel from "../TabPanel";
import TicketsList from "../TicketsList";

import { Button, Divider } from "@material-ui/core";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TicketsQueueSelect from "../TicketsQueueSelect";

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
    gap: 16,
    alignItems: "center",
    padding: "8px 16px",
  },

  serachInputWrapper: {
    // minWidth: 200,
    // minWidth: "100%",
    width: "25rem",
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

const TicketsManager = () => {
  const classes = useStyles();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  // const [showOnlyMyGroups, setShowOnlyMyGroups] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);

  // const [groupCount, setGroupCount] = useState(0);
  // const [openCount, setOpenCount] = useState(0);
  // const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = [...user.queues.map((q) => q.id), null];
  const { whatsApps, loading } = useContext(WhatsAppsContext);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  // const [selectedTypeIds] = useState(["individual"]);
  const [typeIdsForAll] = useState(["individual", "group"]);
  const [typeIdsForIndividuals] = useState(["individual"]);
  const [typeIdsForGroups] = useState(["group"]);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);

  const [numberGroups, setNumberGroups] = useState([]);
  const [numberGroupsModalIsOpen, setNumberGroupsModalIsOpen] = useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const [categories, setCategories] = useState([]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  useEffect(() => {
    localStorage.getItem("selectedWhatsappIds") &&
      setSelectedWhatsappIds(
        JSON.parse(localStorage.getItem("selectedWhatsappIds"))
      );

    localStorage.getItem("selectedQueueIds") &&
      setSelectedQueueIds(JSON.parse(localStorage.getItem("selectedQueueIds")));
  }, []);

  // useEffect(() => {
  //   console.log("selectedTypeIds", selectedTypeIds);
  // }, [selectedTypeIds]);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data);
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
          {/* open */}
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon style={{ fontSize: 21 }} />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          {/* - open */}

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
          <TicketsWhatsappSelect
            style={{ marginLeft: 6 }}
            selectedWhatsappIds={selectedWhatsappIds || []}
            userWhatsapps={whatsApps || []}
            onChange={(values) => setSelectedWhatsappIds(values)}
          />
          {/* - WPP SELECT */}

          {/* QUEUE SELECT */}
          <TicketsQueueSelect
            style={{ marginLeft: 6 }}
            selectedQueueIds={selectedQueueIds}
            userQueues={user?.queues}
            onChange={(values) => setSelectedQueueIds(values)}
          />
          {/* - QUEUE SELECT */}

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
        </div>
      </Paper>
      {/* - TABS */}

      {/* INBOX TAB CONTENT  */}
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        {/* TABS */}
        {/* <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <StyledTab
            label={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0px",
                  fontSize: "13px",
                  textTransform: "initial",
                }}
              >
                <Badge
                  overlap="rectangular"
                  badgeContent={groupCount}
                  color="primary"
                  max={99999}
                >
                  {!showOnlyMyGroups ? "Todos los grupos" : "Mis grupos"}
                </Badge>

                <>
                  <ArrowDropDownIcon fontSize="medium" onClick={handleClick2} />

                  <Menu
                    anchorEl={anchorEl2}
                    open={Boolean(anchorEl2)}
                    onClose={handleClose2}
                  >
                    <MenuItem
                      onClick={(e) => {
                        setShowOnlyMyGroups(false);
                        handleClose2(e);
                      }}
                    >
                      Todos los grupos
                    </MenuItem>
                    <MenuItem
                      onClick={(e) => {
                        setShowOnlyMyGroups(true);
                        handleClose2(e);
                      }}
                    >
                      Mis grupos
                    </MenuItem>
                  </Menu>
                </>
              </div>
            }
            value={"groups"}
          />
          <StyledTab
            label={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0px",
                  fontSize: "13px",
                  textTransform: "initial",
                }}
              >
                <Badge
                  overlap="rectangular"
                  badgeContent={openCount}
                  color="primary"
                  max={99999}
                >
                  {showAllTickets ? "Todos los chats" : "Mis chats"}
                </Badge>

                <Can
                  role={user.profile}
                  perform="tickets-manager:showall"
                  yes={() => (
                    <>
                      <ArrowDropDownIcon
                        fontSize="medium"
                        onClick={handleClick}
                      />

                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                      >
                        <MenuItem
                          onClick={(e) => {
                            setShowAllTickets(true);
                            handleClose(e);
                          }}
                        >
                          Todos los chats
                        </MenuItem>
                        <MenuItem
                          onClick={(e) => {
                            setShowAllTickets(false);
                            handleClose(e);
                          }}
                        >
                          Mis chats
                        </MenuItem>
                      </Menu>
                    </>
                  )}
                />
              </div>
            }
            value={"open"}
          />
          <StyledTab
            label={
              <div
                style={{
                  fontSize: "13px",
                  textTransform: "initial",
                }}
              >
                <Badge
                  overlap="rectangular"
                  badgeContent={pendingCount}
                  color="secondary"
                  max={99999}
                >
                  Pendientes
                </Badge>
              </div>
            }
            value={"pending"}
          />
        </Tabs> */}
        {/* - TABS */}

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
          <Can
            role={user.profile}
            perform="tickets-manager:showall"
            yes={() => (
              <>
                {tab === "open" && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        marginLeft: "auto",
                        padding: "8px 16px 0px",
                      }}
                    >
                      <div>
                        INDIVIDUALES - {showAllTickets ? "TODOS" : "MÍOS"}
                      </div>
                      <ArrowDropDownIcon
                        fontSize="medium"
                        style={{
                          cursor: "pointer",
                          scale: "1.5",
                        }}
                        onClick={handleClick}
                      />

                      <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                      >
                        <MenuItem
                          onClick={(e) => {
                            setShowAllTickets(true);
                            handleClose(e);
                          }}
                        >
                          Todos los chats
                        </MenuItem>
                        <MenuItem
                          onClick={(e) => {
                            setShowAllTickets(false);
                            handleClose(e);
                          }}
                        >
                          Mis chats
                        </MenuItem>
                      </Menu>
                    </div>
                  </>
                )}
              </>
            )}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 16,
              padding: "16px 16px 16px",
              overflow: "auto",
              flexGrow: 1,
            }}
          >
            {/*  */}
            <TicketsList
              status="open"
              showAll={true}
              searchParam={searchParam}
              // showOnlyMyGroups={showOnlyMyGroups}
              selectedTypeIds={typeIdsForGroups}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              // updateCount={(val) => {
              //   setGroupCount(val);
              // }}
              ticketsType="groups"
            />

            {/* <Divider orientation="vertical" flexItem /> */}

            <TicketsList
              status="pending"
              searchParam={searchParam}
              selectedTypeIds={typeIdsForAll}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              // updateCount={(val) => setPendingCount(val)}
              ticketsType="pendings"
            />

            <Divider orientation="vertical" flexItem />

            <TicketsList
              status="open"
              searchParam={searchParam}
              showAll={showAllTickets}
              selectedTypeIds={typeIdsForIndividuals}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              // updateCount={(val) => setOpenCount(val)}
              ticketsType="no-category"
            />

            {categories.map((category) => (
              <TicketsList
                key={category.id}
                searchParam={searchParam}
                category={category}
                status="open"
                showAll={showAllTickets}
                selectedTypeIds={typeIdsForIndividuals}
                selectedWhatsappIds={selectedWhatsappIds}
                selectedQueueIds={selectedQueueIds}
                // updateCount={(val) => setOpenCount(val)}
              />
            ))}
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
          searchParam={searchParam}
          status="closed"
          showAll={true}
          selectedTypeIds={typeIdsForAll}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      {/* - closed TAB CONTENT */}

      {/* search TAB CONTENT */}
      {/* <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          selectedTypeIds={typeIdsForAll}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel> */}
      {/* - search TAB CONTENT */}
    </Paper>
  );
};

export default TicketsManager;
