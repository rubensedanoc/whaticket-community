import Chip from "@material-ui/core/Chip";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import React, { useEffect, useState } from "react";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
  },
}));

const MarketingCampaignSelect = ({ selectedIds, onChange, onLoadData }) => {
  const classes = useStyles();
  const [marketingCampaigns, setMarketingCampaigns] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/marketingCampaigns");
        setMarketingCampaigns(data);
        if (onLoadData) {
          onLoadData(data);
        }
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div style={{ marginTop: 6 }}>
      <FormControl fullWidth margin="dense" variant="outlined">
        <InputLabel>Campañas de marketing</InputLabel>
        <Select
          multiple
          label="Campañas de marketing"
          value={selectedIds}
          onChange={handleChange}
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
          renderValue={(selected) => (
            <div className={classes.chips}>
              {selected?.length > 0 &&
                selected.map((id) => {
                  const marketingCampaign = marketingCampaigns.find(
                    (q) => q.id === id
                  );
                  return marketingCampaign ? (
                    <Chip
                      key={id}
                      style={{ backgroundColor: marketingCampaign.color }}
                      variant="outlined"
                      label={marketingCampaign.name}
                      className={classes.chip}
                    />
                  ) : null;
                })}
            </div>
          )}
        >
          {marketingCampaigns.map((marketingCampaign) => (
            <MenuItem key={marketingCampaign.id} value={marketingCampaign.id}>
              {marketingCampaign.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default MarketingCampaignSelect;
