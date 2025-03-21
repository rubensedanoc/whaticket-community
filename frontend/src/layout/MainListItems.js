import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { Badge } from "@material-ui/core";
import Divider from "@material-ui/core/Divider";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import BarChartIcon from "@material-ui/icons/BarChart";
import CategoryOutlinedIcon from "@material-ui/icons/CategoryOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import FacebookIcon from "@material-ui/icons/Facebook";
import HttpIcon from "@material-ui/icons/Http";
import MessageOutlinedIcon from "@material-ui/icons/MessageOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import SendIcon from "@material-ui/icons/Send";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import { getREACT_APP_PURPOSE } from "../config";

import { Can } from "../components/Can";
import { AuthContext } from "../context/Auth/AuthContext";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { i18n } from "../translate/i18n";

function ListItemLink(props) {
  const { icon, primary, to, className } = props;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  return (
    <li>
      <ListItem button component={renderLink} className={className}>
        {icon ? (
          <ListItemIcon style={{ minWidth: "fit-content", marginRight: 12 }}>
            {icon}
          </ListItemIcon>
        ) : null}
        <ListItemText primary={primary} />
      </ListItem>
    </li>
  );
}

const MainListItems = (props) => {
  const { drawerClose } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  return (
    <div onClick={drawerClose}>
      <ListItemLink
        to="/"
        primary="Dashboard"
        icon={<DashboardOutlinedIcon />}
      />
      <ListItemLink
        to="/connections"
        primary={i18n.t("mainDrawer.listItems.connections")}
        icon={
          <Badge
            overlap="rectangular"
            badgeContent={connectionWarning ? "!" : 0}
            color="error"
          >
            <SyncAltIcon />
          </Badge>
        }
      />
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
      />

      <ListItemLink
        to="/messages"
        primary={"Mensajes"}
        icon={<MessageOutlinedIcon />}
      />

      <ListItemLink
        to="/contacts"
        primary={i18n.t("mainDrawer.listItems.contacts")}
        icon={<ContactPhoneOutlinedIcon />}
      />
      <ListItemLink
        to="/quickAnswers"
        // primary={i18n.t("mainDrawer.listItems.quickAnswers")}
        primary={"Resp. Rápidas"}
        icon={<QuestionAnswerOutlinedIcon />}
      />
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Divider />

            <ListSubheader inset style={{ padding: 0, paddingLeft: 52 }}>
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>

            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
            />

            <ListItemLink
              to="/queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
            />

            <ListItemLink
              to="/categories"
              primary={"Categorias"}
              icon={<CategoryOutlinedIcon />}
            />

            {(!getREACT_APP_PURPOSE() ||
              getREACT_APP_PURPOSE() === "general") && (
              <ListItemLink
                to="/messagingCampaigns"
                primary={"Campañas de mensajes"}
                icon={<SendIcon />}
              />
            )}

            {getREACT_APP_PURPOSE() === "comercial" && (
              <ListItemLink
                to="/marketingCampaigns"
                primary={"Campañas de Mrkt"}
                icon={<FacebookIcon />}
              />
            )}

            <ListItemLink
              to="/reportsv2"
              primary={"Reportes"}
              icon={<BarChartIcon />}
            />

            <ListItemLink
              to="/api-chatbot"
              primary={"Api Chatbot"}
              icon={<HttpIcon />}
            />

            <ListItemLink
              to="/settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
            />
          </>
        )}
        no={() =>
          getREACT_APP_PURPOSE() === "comercial" ? (
            <>
              <ListItemLink
                to="/reportsv2"
                primary={"Reportes"}
                icon={<BarChartIcon />}
              />
            </>
          ) : null
        }
      />
    </div>
  );
};

export default MainListItems;
