import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";

const useStyles = makeStyles(theme => ({
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	},
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");

	useEffect(() => {
		if (!imageUrl) {
			setBlobUrl("");
			setFetching(false);
			return;
		}

		// Evita XHR para URLs externas (S3/CDN), que requiere CORS.
		// Para mostrar imagen basta usar src directo.
		setBlobUrl(imageUrl);
		setFetching(false);
	}, [imageUrl]);

	return (
		<ModalImage
			className={classes.messageMedia}
			smallSrcSet={fetching ? imageUrl : blobUrl}
			medium={fetching ? imageUrl : blobUrl}
			large={fetching ? imageUrl : blobUrl}
			alt="image"
		/>
	);
};

export default ModalImageCors;
