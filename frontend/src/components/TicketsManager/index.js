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
  const [showAll, setShowAll] = useState(false);
  const [showOnlyMyGroups, setShowOnlyMyGroups] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);

  const userQueueIds = [...user.queues.map((q) => q.id), null];
  const { whatsApps } = useContext(WhatsAppsContext);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  const [principalTicketType, setPrincipalTicketType] = useState("");

  const [typeIdsForAll] = useState(["individual", "group"]);
  const [typeIdsForIndividuals] = useState(["individual"]);
  const [typeIdsForGroups] = useState(["group"]);

  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);

  const [numberGroups, setNumberGroups] = useState([]);
  const [numberGroupsModalIsOpen, setNumberGroupsModalIsOpen] = useState(false);

  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorEl2, setAnchorEl2] = useState(null);

  const [categories, setCategories] = useState([]);

  const [categoriesVisible, setCategoriesVisible] = useState([]);

  useEffect(() => {
    localStorage.getItem("principalTicketType") &&
      setPrincipalTicketType(
        JSON.parse(localStorage.getItem("principalTicketType"))
      );

    localStorage.getItem("showAll") &&
      setShowAll(JSON.parse(localStorage.getItem("showAll")));

    localStorage.getItem("showOnlyMyGroups") &&
      setShowOnlyMyGroups(JSON.parse(localStorage.getItem("showOnlyMyGroups")));

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

  // useEffect(() => {
  //   if (user.profile.toUpperCase() === "ADMIN") {
  //     setShowAll(true);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/categories");

        const categoriesOrder =
          JSON.parse(localStorage.getItem("categoriesOrder")) || [];

        const sortedCategories = ["no-category", ...data].sort((a, b) => {
          const indexA = categoriesOrder.indexOf(a.name || a);
          const indexB = categoriesOrder.indexOf(b.name || b);

          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }

          if (indexA === -1) return 1;
          if (indexB === -1) return -1;

          return 0;
        });

        console.log("sortedCategories", sortedCategories);

        setCategories(sortedCategories);

        let categoriesVisible = localStorage.getItem("categoriesVisible");

        if (categoriesVisible) {
          categoriesVisible = JSON.parse(categoriesVisible);
        } else {
          localStorage.setItem(
            "categoriesVisible",
            JSON.stringify([
              ...sortedCategories.map((category) => category.name || category),
            ])
          );
          categoriesVisible = [
            ...sortedCategories.map((category) => category.name || category),
          ];
        }

        setCategoriesVisible(categoriesVisible);

        console.log("categoriesVisible", categoriesVisible);
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

  const onMove = (oldIndex, direction) => {
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
      (category) => category.name || "no-category"
    );
    localStorage.setItem("categoriesOrder", JSON.stringify(categoryIds));

    console.log("newCategories", newCategories);

    setCategories(newCategories);
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
                  }}
                >
                  <div>
                    DIVIDIR POR -{" "}
                    {principalTicketType === "groups"
                      ? "GRUPALES"
                      : "INDIVIDUALES"}
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
              }}
            >
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
                          {principalTicketType === "individuals"
                            ? "INDIVIDUALES"
                            : "GRUPOS"}{" "}
                          -{" "}
                          {principalTicketType === "individuals"
                            ? showAll
                              ? "TODOS"
                              : "MÍOS"
                            : showOnlyMyGroups
                            ? "PARTICIPANDO"
                            : "TODOS"}
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

              <Badge
                overlap="rectangular"
                badgeContent={categoriesVisible?.length}
                max={99999}
                color="secondary"
                invisible={categoriesVisible?.length === 0}
                className="TicketsWhatsappSelect"
              >
                <div style={{}}>
                  <FormControl>
                    <Select
                      multiple
                      displayEmpty
                      variant="outlined"
                      value={categoriesVisible}
                      onChange={(e) => {
                        console.log("e.target.value", e.target.value);
                        localStorage.setItem(
                          "categoriesVisible",
                          JSON.stringify(e.target.value)
                        );
                        setCategoriesVisible(e.target.value);
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
                        categories.map((category) => (
                          <MenuItem
                            dense
                            key={category.name || category}
                            value={category.name || category}
                          >
                            <Checkbox
                              style={{
                                color: "black",
                              }}
                              size="small"
                              color="primary"
                              checked={
                                categoriesVisible.indexOf(
                                  category.name || category
                                ) >= 0
                              }
                            />
                            <ListItemText primary={category.name || category} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </div>
              </Badge>
            </div>
          </div>

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
              searchParam={searchParam}
              showAll={showAll}
              setShowAll={setShowAll}
              showOnlyMyGroups={showOnlyMyGroups}
              setShowOnlyMyGroups={setShowOnlyMyGroups}
              selectedTypeIds={
                principalTicketType === "groups"
                  ? typeIdsForIndividuals
                  : typeIdsForGroups
              }
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              ticketsType={
                principalTicketType === "groups" ? "individuals" : "groups"
              }
            />

            <TicketsList
              status="pending"
              searchParam={searchParam}
              selectedTypeIds={typeIdsForAll}
              selectedWhatsappIds={selectedWhatsappIds}
              selectedQueueIds={selectedQueueIds}
              ticketsType="pendings"
            />

            <Divider orientation="vertical" flexItem />
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
                  ticketsType="no-category"
                  onMoveToLeft={() => onMove(categoryIndex, "left")}
                  onMoveToRight={() => {
                    onMove(categoryIndex, "right");
                  }}
                  categoriesVisible={categoriesVisible}
                />
              ) : (
                <TicketsList
                  key={category.name}
                  status="open"
                  searchParam={searchParam}
                  category={category}
                  showAll={showAll}
                  showOnlyMyGroups={showOnlyMyGroups}
                  selectedTypeIds={
                    principalTicketType === "groups"
                      ? typeIdsForGroups
                      : typeIdsForIndividuals
                  }
                  selectedWhatsappIds={selectedWhatsappIds}
                  selectedQueueIds={selectedQueueIds}
                  onMoveToLeft={() => onMove(categoryIndex, "left")}
                  onMoveToRight={() => {
                    onMove(categoryIndex, "right");
                  }}
                  categoriesVisible={categoriesVisible}
                />
              );
            })}
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
