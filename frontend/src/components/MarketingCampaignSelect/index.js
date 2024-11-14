import { Checkbox, ListItemText } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
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

const MarketingCampaignSelect = ({
  selectedIds,
  onChange,
  onLoadData,
  chips = true,
}) => {
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
    <Badge
      overlap="rectangular"
      badgeContent={selectedIds.length}
      color="primary"
      max={99999}
      invisible={selectedIds.length === 0 || chips}
    >
      <div style={chips ? { marginTop: 6 } : { width: 240 }}>
        <FormControl fullWidth margin="dense" variant="outlined">
          {chips && <InputLabel>Campañas de marketing</InputLabel>}
          <Select
            multiple
            label={chips ? "Campañas de marketing" : undefined}
            displayEmpty={!chips}
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
            renderValue={(selected) =>
              chips ? (
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
              ) : (
                "Campañas de marketing"
              )
            }
          >
            {marketingCampaigns.map((marketingCampaign) => (
              <MenuItem key={marketingCampaign.id} value={marketingCampaign.id}>
                {chips ? (
                  marketingCampaign.name
                ) : (
                  <>
                    <Checkbox
                      style={{
                        color: marketingCampaign.color || "black",
                      }}
                      size="small"
                      color="primary"
                      checked={selectedIds.indexOf(marketingCampaign.id) > -1}
                    />
                    <ListItemText primary={marketingCampaign.name} />
                  </>
                )}
              </MenuItem>
            ))}

            {!chips && (
              <MenuItem value={null}>
                <Checkbox
                  style={{
                    color: "black",
                  }}
                  size="small"
                  color="primary"
                  checked={selectedIds.indexOf(null) > -1}
                />
                <ListItemText primary="Sin campaña" />
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </div>
    </Badge>
  );
};

export default MarketingCampaignSelect;
