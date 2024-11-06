import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@material-ui/core";

import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MarketingCampaignModal from "../../components/MarketingCampaignModal";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_CATEGORIES") {
    const categories = action.payload;
    const newCategories = [];

    categories.forEach((marketingCampaign) => {
      const marketingCampaignIndex = state.findIndex(
        (q) => q.id === marketingCampaign.id
      );
      if (marketingCampaignIndex !== -1) {
        state[marketingCampaignIndex] = marketingCampaign;
      } else {
        newCategories.push(marketingCampaign);
      }
    });

    return [...state, ...newCategories];
  }

  if (action.type === "UPDATE_CATEGORIES") {
    const marketingCampaign = action.payload;
    const marketingCampaignIndex = state.findIndex(
      (u) => u.id === marketingCampaign.id
    );

    if (marketingCampaignIndex !== -1) {
      state[marketingCampaignIndex] = marketingCampaign;
      return [...state];
    } else {
      return [marketingCampaign, ...state];
    }
  }

  if (action.type === "DELETE_CATEGORY") {
    const marketingCampaignId = action.payload;
    const marketingCampaignIndex = state.findIndex(
      (q) => q.id === marketingCampaignId
    );
    if (marketingCampaignIndex !== -1) {
      state.splice(marketingCampaignIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MarketingCampaigns = () => {
  const classes = useStyles();

  const [marketingCampaigns, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [marketingCampaignModalOpen, setMarketingCampaignModalOpen] =
    useState(false);
  const [selectedMarketingCampaign, setSelectedMarketingCampaign] =
    useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/marketingCampaigns");
        dispatch({ type: "LOAD_CATEGORIES", payload: data });

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("marketingCampaign", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({
          type: "UPDATE_CATEGORIES",
          payload: data.marketingCampaign,
        });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_CATEGORY",
          payload: data.marketingCampaignId,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenMarketingCampaignModal = () => {
    setMarketingCampaignModalOpen(true);
    setSelectedMarketingCampaign(null);
  };

  const handleCloseMarketingCampaignModal = () => {
    setMarketingCampaignModalOpen(false);
    setSelectedMarketingCampaign(null);
  };

  const handleEditMarketingCampaign = (marketingCampaign) => {
    setSelectedMarketingCampaign(marketingCampaign);
    setMarketingCampaignModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedMarketingCampaign(null);
  };

  const handleDeleteMarketingCampaign = async (marketingCampaignId) => {
    try {
      await api.delete(`/marketingCampaign/${marketingCampaignId}`);
      toast.success(i18n.t("MarketingCampaign deleted successfully!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedMarketingCampaign(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedMarketingCampaign &&
          `${i18n.t("categories.confirmationModal.deleteTitle")} ${
            selectedMarketingCampaign.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() =>
          handleDeleteMarketingCampaign(selectedMarketingCampaign.id)
        }
      >
        {i18n.t("categories.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <MarketingCampaignModal
        open={marketingCampaignModalOpen}
        onClose={handleCloseMarketingCampaignModal}
        marketingCampaignId={selectedMarketingCampaign?.id}
      />
      <div style={{ padding: "2rem", height: "85%" }}>
        <MainHeader>
          <Title>Campañas de marketing</Title>
          <MainHeaderButtonsWrapper>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenMarketingCampaignModal}
            >
              Agregar Campaña
            </Button>
          </MainHeaderButtonsWrapper>
        </MainHeader>
        <Paper className={classes.mainPaper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">Nombre</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <>
                {marketingCampaigns?.map((marketingCampaign) => (
                  <TableRow key={marketingCampaign.id}>
                    <TableCell align="center">
                      {marketingCampaign.name}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleEditMarketingCampaign(marketingCampaign)
                        }
                      >
                        <Edit />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedMarketingCampaign(marketingCampaign);
                          setConfirmModalOpen(true);
                        }}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {loading && <TableRowSkeleton columns={4} />}
              </>
            </TableBody>
          </Table>
        </Paper>
      </div>
    </MainContainer>
  );
};

export default MarketingCampaigns;
