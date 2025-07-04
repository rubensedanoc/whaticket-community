import React from "react";

import { Avatar, CardHeader } from "@material-ui/core";

const TicketInfo = ({ contact, ticket, onClick, microServiceData }) => {
  return (
    <CardHeader
      onClick={onClick}
      style={{ cursor: "pointer" }}
      titleTypographyProps={{ noWrap: true }}
      subheaderTypographyProps={{ noWrap: true }}
      avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
      title={`${contact.name} #${contact.id}`}
      subheader={
        <>
          <div>{`Conexión: ${ticket?.whatsapp?.name}`}</div>
          <div>
            {!ticket.isGroup && ticket.user && `Asignado: ${ticket.user.name}`}
          </div>
          <div>
            {ticket.isGroup && ticket.participantUsers?.length > 0 && (
              <div>
                Participando:{" "}
                {ticket.participantUsers?.map((pu) => (
                  <span key={pu.id}>{pu.name} - </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ maxHeight: "10vh", overflowY: "auto" }}>
            {microServiceData
              ? microServiceData.map((data, index) => (
                  <div key={index}>
                    {" - "}
                    <a href={"https://" + data.link_dominio} target="_blank">
                      {data.link_dominio}
                    </a>
                    <span> cs: {data.localbi_kam}</span>
                  </div>
                ))
              : contact.domain && (
                  <a href={contact.domain} target="_blank">
                    {contact.domain}
                  </a>
                )}
          </div>
        </>
      }
    />
  );
};

export default TicketInfo;
