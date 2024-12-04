import { Checkbox, ListItemText } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import Chip from "@material-ui/core/Chip";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import ListSubheader from "@material-ui/core/ListSubheader";
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

const MarketingMessaginCampaignSelect = ({
  visibleIds,
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

        let filteredData = data;

        if (visibleIds) {
          console.log(visibleIds);
          console.log(
            data.filter(
              (marketingCampaign) =>
                visibleIds.indexOf(marketingCampaign.id) > -1
            )
          );

          filteredData = data.filter(
            (marketingCampaign) => visibleIds.indexOf(marketingCampaign.id) > -1
          );
        }

        setMarketingCampaigns(filteredData);
        if (onLoadData) {
          onLoadData(data);
        }
      } catch (err) {
        toastError(err);
      }
    })();
  }, [visibleIds]);

  const handleChange = (e) => {
    console.log(e.target);

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
      <div style={chips ? { marginTop: 6 } : { width: 340 }}>
        <FormControl fullWidth margin="dense" variant="outlined">
          {chips && <InputLabel>Campañas de mensajes de marketing</InputLabel>}
          <Select
            multiple
            label={chips ? "Campañas de mensajes de marketing" : undefined}
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
                "Campañas de mensajes de marketing"
              )
            }
          >
            {marketingCampaigns.reduce((result, marketingCampaign) => {
              result.push(
                <ListSubheader
                  key={`subheader-${marketingCampaign.id}`}
                  style={{ position: "relative", pointerEvents: "none" }}
                >
                  {marketingCampaign.name}
                </ListSubheader>
              );

              result.push(
                <MenuItem value={marketingCampaign.id + "-null"}>
                  <Checkbox
                    style={{
                      color: marketingCampaign.color || "black",
                    }}
                    size="small"
                    color="primary"
                    checked={
                      selectedIds.indexOf(marketingCampaign.id + "-null") > -1
                    }
                  />
                  <ListItemText primary={"No campaña"} />
                </MenuItem>
              );

              result.push(
                ...marketingCampaign.marketingMessagingCampaigns.map(
                  (marketingMessagingCampaign) => (
                    <MenuItem
                      key={`${marketingCampaign.id} + ${marketingMessagingCampaign.id}`}
                      value={`${marketingCampaign.id}-${marketingMessagingCampaign.id}`}
                    >
                      <Checkbox
                        style={{
                          color: marketingMessagingCampaign.color || "black",
                        }}
                        size="small"
                        color="primary"
                        checked={
                          selectedIds.indexOf(
                            `${marketingCampaign.id}-${marketingMessagingCampaign.id}`
                          ) > -1
                        }
                      />
                      <ListItemText primary={marketingMessagingCampaign.name} />
                    </MenuItem>
                  )
                )
              );
              return result;
            }, [])}
          </Select>
        </FormControl>
      </div>
    </Badge>
  );
};

export default MarketingMessaginCampaignSelect;
