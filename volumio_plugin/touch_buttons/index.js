"use strict";

let libQ = require("kew");
const MPR121 = require("./lib/mpr121.js");
let io = require("socket.io-client");


let socket = io.connect("http://localhost:3000");

const las = require("./lib/ledstate.js");

const DEBOUNCE_TIMEOUT = 200;

// volumio status
let volumioLastStatus = "na";

module.exports = TouchButtons;

function TouchButtons(context) {
	let self = this;
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger = self.context.logger;

	// setup state tracking
	self.las = new las.LedAmpState(self.logger);

	// one per possible button
	self.actions = Array(12).fill({
		enabled: false,
		action: "",
		debouncing: false,
	});
}

TouchButtons.prototype.onVolumioStart = function () {
	let self = this;
	self.logger.info("[Touch-Buttons] > onVolumioStart");

	// var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	// this.config = new (require("v-conf"))();

	self.mpr121 = new MPR121(0x5a, 1);
	self.mpr121.reset();

	// set state and also update the led as well
	self.las.set_state(las.START_UP, true);

	// power on amp
	self.las.pwrAmp();

	let defer = libQ.defer();

	if (!socket.connected) {
		socket = io.connect("http://localhost:3000");
		socket.on("connect", function () {
			defer.resolve();
		});
	} else {
		defer.resolve();
	}

	self.logger.info("[Touch-Buttons] < onVolumioStart");
	return defer.promise;
};

TouchButtons.prototype.onStart = function () {
	let self = this;
	self.logger.info("[Touch-Buttons] > onStart");

	// preload
	// include a boolean to indicate if this action is mid-debounce
	self.actions[0] = { enabled: true, action: "playPause", debouncing: false };
	self.actions[1] = { enabled: true, action: "previous", debouncing: false };
	self.actions[2] = { enabled: true, action: "next", debouncing: false };
	self.actions[3] = { enabled: true, action: "shuffle", debouncing: false };
	self.actions[4] = { enabled: true, action: "radio", debouncing: false };
	self.actions[5] = { enabled: true, action: "spotify_a", debouncing: false };
	self.actions[6] = { enabled: true, action: "spotify_b", debouncing: false };
	self.actions[7] = { enabled: true, action: "nas", debouncing: false };

	// call back for the capactive events
	let callback = self.listen.bind(self);
	self.mpr121.on("touch", callback);

	// set call back to listen for any events that occur
	socket.on("pushState", self.parseStatus.bind(self));

	// see what the current state is
	self.las.logstate();

	self.logger.info("[Touch-Buttons] < onStart");
	return libQ.resolve();
};

TouchButtons.prototype.parseStatus = function (state) {
	let self = this;
	self.logger.info(
		`[Touch-Buttons] > parseStatus volumio_state:${state.status} previous:${volumioLastStatus} service:${state.service}`
	);

	self.las.logstate();
	if (state.status !== volumioLastStatus) {
		if (volumioLastStatus == "na") {
			self.logger.info(`[Touch-Buttons] Ready to start up....`);
			self.las.set_state(las.PAUSED);
		} else if (
			(state.status == "pause" || state.status == "stop") &&
			volumioLastStatus != "pause" &&
			volumioLastStatus != "stop"
		) {
			if (!self.las.is_pending()) {
				self.logger.info("[Touch-Buttons] Nothing pending so can pause");
				self.las.set_state(las.PAUSED);
			} else {
				self.logger.info(`[Touch-Buttons] Not pausing as state is pending ${self.las.STATE} `);
			}
		} else {
			// this is a play action
			// might have come from UI or from the physical buttons
			self.logger.info(`[Touch-Buttons] Play state ${self.las.STATE} `);
			if (self.las.is_pending()) {
				self.las.action(las.CONFIRM);
			} else if (self.las.is_paused()) {
				// set the state to what is requested
				// this isn't a pending state
				switch (state.service) {
					case "spop":
						self.las.set_state(las.SPOTIFY_1);
						break;
					case "webradio":
						self.las.set_state(las.RADIO);
						break;
				}
			} else {
				self.logger.inof(`[Touch-Buttons]  errrr`);
			}
		
		}
	}
	volumioLastStatus = state.status;

	// update the display to reflect the current state
	self.logger.info("[Touch-Buttons] Setting LEDs");
	self.las.led_state_set();
	self.las.logstate();

	self.logger.info('[Touch-Buttons] < parseStatus');
};

TouchButtons.prototype.onStop = function () {
	let self = this;
	self.logger.info("[Touch-Buttons] > onStop");
	for (let a of self.actions) {
		a["enabled"] == false;
	}

	self.mpr121.reset();
	self.las.muteAmp();
	self.las.pwrAmp(false);

	self.logger.info("[Touch-Buttons] < onStop");
	return libQ.resolve();
};

TouchButtons.prototype.onRestart = function () {
	let self = this;
	self.mpr121.reset();
};

// ---------------------------------------------------------------------------

TouchButtons.prototype.listen = function (pin) {
	let self = this;
	self.logger.info(`[Touch-Buttons] > touch := ${pin}`);

	let a = self.actions[pin];

	if (a.enabled == true && a.debouncing == false && !self.las.is_startup()) {
		self.logger.info("[Touch-Buttons] Action enabled");
		a.debouncing = true;

		const resetDebounce = function (pin) {
			this.actions[pin].debouncing = false;
		};

		setTimeout(resetDebounce.bind(self, pin), DEBOUNCE_TIMEOUT);

		switch (a.action) {
			case "shuffle":
				self.logger.info("[Touch-Buttons] shuffle");
				self.las.led_pulse();
				self.shuffle();
				break;

			case "next":
				self.logger.info("[Touch-Buttons] next..");
				self.las.led_pulse();
				self.move("next");
				break;

			case "previous":
				self.logger.info("[Touch-Buttons] previous..");
				self.las.led_pulse();
				self.move("prev");
				break;

			case "playPause":
				self.logger.info("[Touch-Buttons] play/pause..");
				self.playPause();
				break;

			case "spotify_a":
				if (!self.las.is_spotify_1()) {
					self.logger.info("[Touch-Buttons] changing to spotify-a");
					self.spotify();
				}
				break;

			case "spotify_b":
				if (!self.las.is_spotify_2()) {
					self.logger.info("[Touch-Buttons] changing to spotify-b");
					self.spotify("Liked from Radio");
				}
				break;

			case "nas":
				if (!self.las.is_nas()) {
					self.logger.info("[Touch-Buttons] changing to NAS");
					// self.radio()
				}
				break;

			case "radio":
				if (!self.las.is_radio()) {
					self.logger.info("[Touch-Buttons] changing to radio");
					self.radio();
				}
				break;

			default:
				break;
		}
	} else {
		self.logger.info(`Pin ${pin} action not enabled`);
	}

	self.logger.info('[Touch-Buttons] < touch');
};

// spotify:user:spotify:playlist:0BtQmW4ubTY6lrs7Ud1tC8
TouchButtons.prototype.spotify = function (playlistName = "Main") {
	let self = this;
	let defer = libQ.defer();
	self.logger.info(`[Touch-Buttons] > Spotify ${playlistName}`);

	self.las.set_state(las.SPOTIFY_1_PENDING);
	self.commandRouter
		.executeOnPlugin("music_service", "spop", "getMyPlaylists", "")
		.then(function (pl) {
			let playlists = pl.navigation.lists[0].items.filter(
				(p) => p.title === playlistName
			);
			self.logger.info(
				`[Touch-Buttons] Got playlists back ${playlists} ${playlists.length} ${playlists[0]}`
			);
			let p = playlists[0];
			self.logger.info(`[Touch-Buttons] spotify swap to uri ${p.uri}`);

			let skt = socket;
			if (!skt.connected) {
				defer.reject(new Error("[Touch-Buttons] !! Skt is not connected"));
			}

			skt.emit("pause");
			skt.emit("clearQueue");
			skt.emit("addPlay", {
				service: "spop",
				title: playlistName,
				uri: p.uri,
			});
			skt.emit("play");
			self.logger.info("[Touch-Buttons] Playing spotifgy...");

			// play event will move on from the pending state
			defer.resolve();

		});

	self.logger.info("[Touch-Buttons] < Spotify");
	return defer.promise;
};

TouchButtons.prototype.move = function (dir) {
	let skt = socket;
	if (!skt.connected) {
		throw new Error("[Touch-Buttons] !! Skt is not connected");
	}
	skt.emit(dir);
};

TouchButtons.prototype.shuffle = function () {
	let skt = socket;
	if (!skt.connected) {
		throw new Error("[Touch-Buttons] !! Skt is not connected");
	}

	skt.emit("setRandom", { value: true });
	skt.emit("next");
};

TouchButtons.prototype.playPause = function () {
	let self = this;
	let defer = libQ.defer();
	let skt = socket;

	self.logger.info(`[Touch-Buttons] > Play-Pause `);
	if (!skt.connected) {
		throw new Error("[Touch-Buttons] !! Skt is not connected");
	}
	socket.emit('getState', '');
	socket.once("pushState", function (state) {
		self.logger.info("[Touch-Buttons] playPause tmp state callback");
		if (state.status == "play" && state.service == "webradio") {
			self.las.set_state(las.PAUSED);
			socket.emit("stop");
		} else if (state.status == "play") {
			self.las.set_state(las.PAUSED);
			socket.emit("pause");
		} else {
			self.las.action(las.RESTORE);
			socket.emit("play");
		}
		defer.resolve();
	});

	self.logger.info(`[Touch-Buttons] < Play-Pause `);
	return defer.promise;
};
// ommunity.volumio.com/t/how-to-push-buttons-for-web-radio-stations/12255
TouchButtons.prototype.radio = function () {
	let self = this;
	let defer = libQ.defer();
	let skt = socket;
	self.logger.info(`[Touch-Buttons] > Radio `);

	if (!skt.connected) {
		throw new Error("[Touch-Buttons] !! Skt is not connected");
	}

	self.las.set_state(las.RADIO_PENDING);

	skt.emit("pause");
	skt.emit("clearQueue");
	skt.emit("addPlay", {
		service: "webradio",
		title: "Wave105",
		uri: "https://stream-mz.planetradio.co.uk/wave105.mp3?direct=true&aw_0_1st.playerid=BMUK_TuneIn&aw_0_1st.skey=7374499933",
		albumart: "http://cdn-radiotime-logos.tunein.com/_0q.jpg?t=73",
	});
	skt.emit("play");
	defer.resolve();

	self.logger.info(`[Touch-Buttons] < Radio `);
	return defer.promise;
};

TouchButtons.prototype.setAdditionalConf = function () {

};

TouchButtons.prototype.onRestart = function () {

};

TouchButtons.prototype.onInstall = function () {

};

TouchButtons.prototype.onUninstall = function () {

};

TouchButtons.prototype.getConfigurationFiles = function () {
	return ["config.json"];
};

TouchButtons.prototype.getUIConfig = function () {
	let defer = libQ.defer();
	let self = this;

	let lang_code = this.commandRouter.sharedVars.get("language_code");

	self.commandRouter
		.i18nJson(
			// eslint-disable-next-line no-undef
			__dirname + "/i18n/strings_" + lang_code + ".json",
			// eslint-disable-next-line no-undef
			__dirname + "/i18n/strings_en.json",
			// eslint-disable-next-line no-undef
			__dirname + "/UIConfig.json"
		)
		.then(function (uiconf) {
			defer.resolve(uiconf);
		})
		.fail(function () {
			defer.reject(new Error());
		});

	return defer.promise;
};

// eslint-disable-next-line no-unused-vars
TouchButtons.prototype.setUIConfig = function (data) {
	//Perform your installation tasks here
};
// eslint-disable-next-line no-unused-vars
TouchButtons.prototype.getConf = function (varName) {

	//Perform your installation tasks here
};
// eslint-disable-next-line no-unused-vars
TouchButtons.prototype.setConf = function (varName, varValue) {

	//Perform your installation tasks here
};
