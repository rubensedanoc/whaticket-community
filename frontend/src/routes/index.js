import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import NotificationManager from "../components/NotificationManager";
import { getREACT_APP_PURPOSE } from "../config";
import { AuthProvider } from "../context/Auth/AuthContext";
import { SearchMessageProvider } from "../context/SearchMessage/SearchMessageContext";
import { UsersPresenceProvider } from "../context/UsersPresenceContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import LoggedInLayout from "../layout";
import ApiChatbot from "../pages/ApiChatbot";
import Categories from "../pages/Categories/";
import ComercialReports from "../pages/ComercialReports";
import Connections from "../pages/Connections/";
import Contacts from "../pages/Contacts/";
import Dashboard from "../pages/Dashboard/";
import Login from "../pages/Login/";
import marketingCampaigns from "../pages/MarketingCampaigns";
import Messages from "../pages/Messages/";
import MessagingCampaigns from "../pages/MessagingCampaigns";
import PublicTickets from "../pages/PublicTickets/";
import Queues from "../pages/Queues/";
import QuickAnswers from "../pages/QuickAnswers/";
import Reports from "../pages/Reports";
import ReportsV2 from "../pages/ReportsV2";
import Settings from "../pages/Settings/";
import Signup from "../pages/Signup/";
import Tickets from "../pages/Tickets/";
import Users from "../pages/Users";
import Route from "./Route";

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Switch>
          <Route exact path="/login" component={Login} />
          <Route exact path="/signup" component={Signup} />
          <Route
            exact
            path="/public-ticket"
            component={PublicTickets}
            isForAll
          />
          <WhatsAppsProvider>
            <UsersPresenceProvider>
              <SearchMessageProvider>
                <LoggedInLayout>
                  <Route exact path="/" component={Dashboard} isPrivate />
                  <Route exact path="/reports" component={Reports} isPrivate />
                  <Route
                    exact
                    path="/api-chatbot"
                    component={ApiChatbot}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/reportsv2"
                    component={(() => {
                      let componentToReturn;
                      switch (getREACT_APP_PURPOSE()) {
                        case "comercial":
                          componentToReturn = ComercialReports;
                          break;

                        case "general":
                          componentToReturn = ReportsV2;
                          break;

                        default:
                          componentToReturn = ReportsV2;
                          break;
                      }
                      return componentToReturn;
                    })()}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/tickets/:ticketId?"
                    component={Tickets}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/connections"
                    component={Connections}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/contacts"
                    component={Contacts}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/messages"
                    component={Messages}
                    isPrivate
                  />
                  <Route exact path="/users" component={Users} isPrivate />
                  <Route
                    exact
                    path="/quickAnswers"
                    component={QuickAnswers}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/Settings"
                    component={Settings}
                    isPrivate
                  />
                  <Route exact path="/Queues" component={Queues} isPrivate />
                  <Route
                    exact
                    path="/categories"
                    component={Categories}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/marketingCampaigns"
                    component={marketingCampaigns}
                    isPrivate
                  />
                  <Route
                    exact
                    path="/messagingCampaigns"
                    component={MessagingCampaigns}
                    isPrivate
                  />
                  <NotificationManager />
                </LoggedInLayout>
              </SearchMessageProvider>
            </UsersPresenceProvider>
          </WhatsAppsProvider>
        </Switch>
        <ToastContainer autoClose={3000} />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
