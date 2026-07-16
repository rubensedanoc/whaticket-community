import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import useWhatsApps from "../../hooks/useWhatsApps";

const useStyles = makeStyles((theme) => ({
  textField: { marginRight: 0, marginBottom: "0.5rem", flex: 1 },
  previewBox: { background: "#f5f5f5", padding: theme.spacing(2), borderRadius: theme.spacing(1), marginTop: theme.spacing(1), marginBottom: theme.spacing(1) }
}));

const LANGUAGES = [
  { code: "es", label: "Español" }, { code: "en", label: "Inglés" }, { code: "pt_BR", label: "Portugués" }
];

const MarketingCampaignAutomaticMessage = ({ open, onClose, onSave, marketingCampaignId, marketingMessagingCampaignId, marketingCampaignAutomaticMessageId }) => {
  const classes = useStyles();
  const [message, setMessage] = useState({ order: 1, body: "" });
  const [resolving, setResolving] = useState(false);
  const [resolvedTemplate, setResolvedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("es");
  const [saving, setSaving] = useState(false);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const { whatsApps } = useWhatsApps();

  useEffect(() => {
    if (!marketingCampaignAutomaticMessageId) return;
    (async () => {
      try {
        const { data } = await api.get(`/marketingCampaignAutomaticMessage/${marketingCampaignAutomaticMessageId}`);
        setMessage(data);
        if (data.templatePayload) {
          const tpl = typeof data.templatePayload === "string" ? JSON.parse(data.templatePayload) : data.templatePayload;
          setResolvedTemplate(tpl);
          setTemplateName(tpl.name || data.body || "");
          setTemplateLanguage(tpl.language || "es");
        }
      } catch (err) { toastError(err); }
    })();
  }, [marketingCampaignAutomaticMessageId]);

  const handleResolve = async () => {
    if (!templateName.trim()) { toast.error("Ingrese el nombre de la plantilla"); return; }
    if (!selectedWhatsappId) { toast.error("Seleccione una conexión WhatsApp"); return; }
    setResolving(true);
    try {
      const { data } = await api.post("/templates/resolve", { name: templateName.trim(), language: templateLanguage, whatsappId: selectedWhatsappId });
      setResolvedTemplate(data);
      toast.success("Plantilla verificada");
    } catch (err) { toastError(err); setResolvedTemplate(null); }
    finally { setResolving(false); }
  };

  const handleSave = async () => {
    if (!resolvedTemplate) { toast.error("Debe verificar la plantilla en Meta"); return; }
    setSaving(true);
    try {
      const payload = { order: message.order, body: resolvedTemplate.name, mediaType: "text", templatePayload: resolvedTemplate, ...(marketingCampaignId && { marketingCampaignId }), ...(marketingMessagingCampaignId && { marketingMessagingCampaignId }) };
      if (marketingCampaignAutomaticMessageId) {
        await api.put(`/marketingCampaignAutomaticMessage/${marketingCampaignAutomaticMessageId}`, payload);
      } else {
        await api.post("/marketingCampaignAutomaticMessage", payload);
      }
      toast.success("Mensaje guardado");
      if (onSave) onSave();
      handleClose();
    } catch (err) { toastError(err); }
    finally { setSaving(false); }
  };

  const handleClose = () => { setMessage({ order: 1, body: "" }); setResolvedTemplate(null); setTemplateName(""); setTemplateLanguage("es"); setSelectedWhatsappId(""); onClose(); };
  const getVarCount = (tpl) => Array.isArray(tpl?.variables) ? tpl.variables.length : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{marketingCampaignAutomaticMessageId ? "Editar mensaje" : "Nuevo mensaje"}</DialogTitle>
      <DialogContent dividers>
        <TextField label="Orden" type="number" value={message.order} onChange={e => setMessage({ ...message, order: +e.target.value })} variant="outlined" fullWidth size="small" className={classes.textField} />

        <TextField label="Nombre de la plantilla" value={templateName} onChange={e => setTemplateName(e.target.value)} variant="outlined" fullWidth size="small" className={classes.textField} placeholder="Ej: bienvenida_cliente" />

        <FormControl variant="outlined" fullWidth size="small" className={classes.textField}>
          <InputLabel>Idioma</InputLabel>
          <Select value={templateLanguage} onChange={e => setTemplateLanguage(e.target.value)} label="Idioma">
            {LANGUAGES.map(l => <MenuItem dense key={l.code} value={l.code}>{l.label}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl variant="outlined" fullWidth size="small" className={classes.textField}>
          <InputLabel>Conexión WhatsApp</InputLabel>
          <Select value={selectedWhatsappId} onChange={e => setSelectedWhatsappId(e.target.value)} label="Conexión WhatsApp">
            {whatsApps?.filter(w => w.apiType === "meta-api").map(w => (
              <MenuItem dense key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="outlined" color="primary" onClick={handleResolve} disabled={resolving || !templateName.trim() || !selectedWhatsappId} fullWidth>
          {resolving ? <CircularProgress size={20} /> : "Buscar en Meta"}
        </Button>

        {resolvedTemplate && (
          <div className={classes.previewBox}>
            <Typography variant="body2"><strong>Nombre:</strong> {resolvedTemplate.name}</Typography>
            <Typography variant="body2"><strong>Header:</strong> {resolvedTemplate.headerType}</Typography>
            <Typography variant="body2"><strong>Variables:</strong> {getVarCount(resolvedTemplate)}</Typography>
            <Typography variant="body2" style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>{resolvedTemplate.bodyText}</Typography>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined">Cancelar</Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving || !resolvedTemplate}>
          {saving ? <CircularProgress size={20} /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarketingCampaignAutomaticMessage;
