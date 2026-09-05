const NJ_CENTER = [40.143, -74.731];
const NJ_BOUNDS = L.latLngBounds([38.79, -75.56], [41.36, -73.88]);
const ONE_MILE_METERS = 1609.34;

const map = L.map("map", {
	center: NJ_CENTER,
	zoom: 8,
	minZoom: 7,
	maxBounds: NJ_BOUNDS.pad(0.25),
	maxBoundsViscosity: 0.75
});

// Waze-style basemap. Waze keeps its own map tiles private, so we use Stadia's
// "OSM Bright" style: OpenStreetMap road data drawn the way a navigation app
// draws it - cream land, yellow roads, blue water, few labels. Much less
// cluttered than the raw OpenStreetMap tiles, so our business pins stand out.
// No API key needed while running on localhost. See README to swap styles.
L.tileLayer("https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png", {
	maxZoom: 20,
	attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markers = L.layerGroup().addTo(map);
let userCircle;
let pendingPin;
let currentListings = [];

const listingList = document.querySelector("#listingList");
const listingCount = document.querySelector("#listingCount");
const statusText = document.querySelector("#statusText");
const composer = document.querySelector("#composer");
const closeComposer = document.querySelector("#closeComposer");
const form = document.querySelector("#listingForm");
const formMessage = document.querySelector("#formMessage");
const selectedLocation = document.querySelector("#selectedLocation");

document.querySelector("#locateButton").addEventListener("click", locateUser);
document.querySelector("#resetButton").addEventListener("click", () => {
	map.fitBounds(NJ_BOUNDS);
	statusText.textContent = "Showing New Jersey. Click any local business location to post.";
});
closeComposer.addEventListener("click", closeForm);

map.fitBounds(NJ_BOUNDS);
map.on("click", (event) => openForm(event.latlng));
map.on("moveend", () => loadListingsForMap());

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	formMessage.textContent = "";

	const data = Object.fromEntries(new FormData(form).entries());
	const payload = {
		ownerName: data.ownerName,
		businessName: data.businessName,
		category: data.category,
		comment: data.comment,
		websiteUrl: data.websiteUrl,
		latitude: Number(data.latitude),
		longitude: Number(data.longitude)
	};

	try {
		const response = await fetch("/api/listings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error("Check the form fields and make sure the pin is inside New Jersey.");
		}

		const created = await response.json();
		currentListings = [created, ...currentListings.filter((listing) => listing.id !== created.id)];
		renderListings(currentListings);
		renderMarkers(currentListings);
		closeForm();
		map.setView([created.latitude, created.longitude], Math.max(map.getZoom(), 13));
		statusText.textContent = `${created.businessName} is now visible on the map.`;
	}
	catch (error) {
		formMessage.textContent = error.message;
	}
});

async function loadListingsForMap() {
	const bounds = map.getBounds();
	const params = new URLSearchParams({
		minLat: bounds.getSouth().toFixed(6),
		maxLat: bounds.getNorth().toFixed(6),
		minLng: bounds.getWest().toFixed(6),
		maxLng: bounds.getEast().toFixed(6)
	});

	try {
		const response = await fetch(`/api/listings?${params}`);
		currentListings = await response.json();
		renderListings(currentListings);
		renderMarkers(currentListings);
		statusText.textContent = currentListings.length
			? "Move the map or select a listing to explore."
			: "No pins in this view yet. Click the map to add one.";
	}
	catch {
		statusText.textContent = "Could not load listings from the local server.";
	}
}

function locateUser() {
	if (!navigator.geolocation) {
		statusText.textContent = "This browser does not support location lookup.";
		return;
	}

	statusText.textContent = "Requesting your location...";
	navigator.geolocation.getCurrentPosition(
		(position) => {
			const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
			if (userCircle) {
				userCircle.remove();
			}
			userCircle = L.circle(latlng, {
				radius: ONE_MILE_METERS,
				color: "#2f8f70",
				fillColor: "#2f8f70",
				fillOpacity: 0.16,
				weight: 2
			}).addTo(map);

			map.setView(latlng, 13);
			statusText.textContent = "Your approximate one-mile area is highlighted.";
		},
		() => {
			statusText.textContent = "Location permission was not granted. You can still move the map manually.";
		},
		{ enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
	);
}

function openForm(latlng) {
	if (!NJ_BOUNDS.pad(0.05).contains(latlng)) {
		statusText.textContent = "Pins are limited to New Jersey for this demo.";
		return;
	}

	if (pendingPin) {
		pendingPin.remove();
	}

	pendingPin = L.marker(latlng, {
		icon: L.divIcon({
			className: "",
			html: '<div class="business-marker">+</div>',
			iconSize: [34, 34],
			iconAnchor: [17, 17]
		})
	}).addTo(map);

	form.latitude.value = latlng.lat.toFixed(6);
	form.longitude.value = latlng.lng.toFixed(6);
	selectedLocation.textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
	formMessage.textContent = "";
	composer.classList.add("open");
	composer.setAttribute("aria-hidden", "false");
	form.ownerName.focus();
}

function closeForm() {
	composer.classList.remove("open");
	composer.setAttribute("aria-hidden", "true");
	form.reset();
	formMessage.textContent = "";
	if (pendingPin) {
		pendingPin.remove();
		pendingPin = null;
	}
}

function renderListings(listings) {
	listingCount.textContent = `${listings.length} ${listings.length === 1 ? "business" : "businesses"} in view`;
	listingList.replaceChildren(...listings.map(createListingCard));
}

function createListingCard(listing) {
	const card = document.createElement("article");
	card.className = "listing-card";

	const button = document.createElement("button");
	button.type = "button";
	button.addEventListener("click", () => {
		map.setView([listing.latitude, listing.longitude], 14);
	});

	const title = document.createElement("h3");
	title.textContent = listing.businessName;

	const meta = document.createElement("div");
	meta.className = "meta";
	meta.textContent = `Posted by ${listing.ownerName}`;

	const category = document.createElement("div");
	category.className = "category-pill";
	category.textContent = displayCategory(listing.category);

	const comment = document.createElement("p");
	comment.textContent = listing.comment;

	button.append(title, meta);
	card.append(button, category, comment);

	if (listing.websiteUrl) {
		const link = document.createElement("a");
		link.className = "listing-link";
		link.href = listing.websiteUrl;
		link.target = "_blank";
		link.rel = "noreferrer";
		link.textContent = listing.websiteUrl.replace(/^https?:\/\//, "");
		card.append(link);
	}

	return card;
}

function renderMarkers(listings) {
	markers.clearLayers();
	listings.forEach((listing) => {
		const marker = L.marker([listing.latitude, listing.longitude], {
			icon: L.divIcon({
				className: "",
				html: `<div class="business-marker ${listing.category.toLowerCase()}">${markerLetter(listing.category)}</div>`,
				iconSize: [34, 34],
				iconAnchor: [17, 17]
			})
		});
		marker.bindPopup(popupHtml(listing));
		markers.addLayer(marker);
	});
}

function popupHtml(listing) {
	const link = listing.websiteUrl
		? `<a class="listing-link" href="${escapeAttr(listing.websiteUrl)}" target="_blank" rel="noreferrer">${escapeHtml(listing.websiteUrl.replace(/^https?:\/\//, ""))}</a>`
		: "";

	return `<div class="popup">
		<h3>${escapeHtml(listing.businessName)}</h3>
		<div class="meta">${escapeHtml(displayCategory(listing.category))} by ${escapeHtml(listing.ownerName)}</div>
		<p>${escapeHtml(listing.comment)}</p>
		${link}
	</div>`;
}

function markerLetter(category) {
	return displayCategory(category).charAt(0);
}

function displayCategory(category) {
	return category.toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (char) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;"
	}[char]));
}

function escapeAttr(value) {
	return escapeHtml(value).replace(/`/g, "&#096;");
}

if (window.lucide) {
	window.lucide.createIcons();
}

loadListingsForMap();
