

const PAUSED = "paused";
const RADIO = "radio";
const RADIO_PENDING = "radio_pending";
const SPOTIFY_1 = "spotify_1";
const SPOTIFY_1_PENDING = "spotify_1_pending";
const SPOTIFY_2 = "spotify_2";
const SPOTIFY_2_PENDING = "spotify_2_pending";
const NAS = "nas";
const NAS_PENDING = "nas_pending";
const START_UP = "start_up";



const RESTORE = "RESTORE";
const CONFIRM = "CONFIRM";

const Gpio = require("onoff").Gpio;

const RED = { r: 1, g: 0, b: 0 };
const GREEN = { r: 0, g: 1, b: 0 };
const BLUE = { r: 0, g: 0, b: 1 };

class LedAmpState {
    // internval callback for led blink
    led_interval_id = null;
    pulse_interval_id = null;

    greenLED = new Gpio(6, "out");
    redLED = new Gpio(26, "out");
    blueLED = new Gpio(12, "out");
    relay_mute = new Gpio(5, "out"); // set on to un-mute
    relay_amp_pwr = new Gpio(13, "out"); // set on to power on 


    STATE = START_UP;
    LAST_STATE = START_UP;

    constructor(logger) {
        this.logger = logger;
    }

    set_led({ r, g, b }) {
        // if interval is active reset.
        if (this.led_interval_id != null) {
            clearTimeout(this.led_interval_id);
            this.led_interval_id = null;
        }

        // if blink active reset
        this.led_action_blink(false);

        this.redLED.writeSync(r);
        this.greenLED.writeSync(g);
        this.blueLED.writeSync(b);
    }

    get_led() {
        let r = this.redLED.readSync();
        let g = this.greenLED.readSync();
        let b = this.blueLED.readSync();
        return { r, g, b };
    }

    // pulse red led
    led_pulse(delay = 400) {
        let { r, g, b } = this.get_led();
        this.set_led(RED);

        this.pulse_interval_id = setTimeout(() => {
            this.pulse_interval_id = null;
            this.set_led({ r, g, b });
        }, delay);
    };

    led_action_blink(action = true) {
        if (action) {
            this.set_led(GREEN);
            this.led_interval_id = setInterval(() => {
                let r = this.greenLED.readSync();
                this.greenLED.writeSync(r == 0 ? 1 : 0);
            }, 250);
        } else if (this.led_interval_id != null) {
            this.led_interval_id = null;
            clearInterval(this.led_interval_id);
            this.greenLED.writeSync(0);
        }
    };

    led_paused() {
        this.set_led(GREEN);
    };

    led_radio() {
        this.set_led(BLUE);
    };

    led_spotify() {
        this.set_led({ r: 0, g: 1, b: 1 });
    };

    led_nas() {
        this.set_led({ r: 1, g: 0, b: 1 });
    };

    led_pending() {
        this.set_led({ r: 1, g: 1, b: 0 });
    }

    is_source_active() {
        return this.STATE === SPOTIFY_1 || this.STATE === SPOTIFY_2 || this.STATE === RADIO || this.state === NAS;
    }

    is_pending() {
        return this.STATE === SPOTIFY_1_PENDING || this.STATE === SPOTIFY_2_PENDING || this.STATE === RADIO_PENDING || this.state === NAS_PENDING;
    }

    is_paused() {
        return this.STATE === PAUSED;
    }

    is_radio() {
        return this.STATE === RADIO;
    }

    is_spotify_1() {
        return this.STATE === SPOTIFY_1;
    }

    is_spotify_2() {
        return this.STATE === SPOTIFY_2;
    }

    is_nas() {
        return this.STATE === NAS;
    }

    is_startup() {
        return this.STATE === START_UP;
    }

    led_state_set() {
        switch (this.STATE) {
            case PAUSED:
                this.led_paused();
                break;
            case RADIO:
                this.led_radio();
                break;
            case SPOTIFY_1:
            case SPOTIFY_2:
                this.led_spotify();
                break;
            case NAS:
                this.led_nas();
                break;
            case START_UP:
                this.led_action_blink();
                break;
            case SPOTIFY_1_PENDING:
            case SPOTIFY_2_PENDING:
            case RADIO_PENDING:
            case NAS_PENDING:
                this.led_pending();
                break;
            default:
                break;
        }
    };

    action(action) {
        switch (action) {
            case RESTORE:
                this.set_state(this.LAST_STATE);
                break;
            case CONFIRM:
                switch (this.STATE) {
                    case SPOTIFY_1_PENDING:
                        this.set_state(SPOTIFY_1);
                        break;
                    case SPOTIFY_2_PENDING:
                        this.set_state(SPOTIFY_2);
                        break;
                    case RADIO_PENDING:
                        this.set_state(RADIO);
                        break;
                    case NAS_PENDING:
                        this.set_state(NAS);
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;

        }
    }

    set_state(newstate, update = false) {
        switch (newstate) {
            case SPOTIFY_1_PENDING:
            case SPOTIFY_2_PENDING:
            case RADIO_PENDING:
            case NAS_PENDING:
                this.LAST_STATE = this.STATE;
                this.STATE = newstate;
                this.muteAmp();
                break;

            case RADIO:
            case SPOTIFY_1:
            case SPOTIFY_2:
            case NAS:
                this.LAST_STATE = this.STATE;
                this.STATE = newstate;
                this.muteAmp(false);
                break;

            case START_UP:
                this.LAST_STATE = this.STATE;
                this.STATE = newstate;
                this.muteAmp();
                break;

            case PAUSED:
                this.LAST_STATE = this.STATE;
                this.STATE = PAUSED;
                this.muteAmp();
                break;

            default:
                break;
        }
      
        if (update) {
            this.led_state_set();
        }
    };

    logstate() {
        let rmute = this.relay_mute.readSync() == 1 ? 'unmuted' : 'muted';
        let rpwr = this.relay_amp_pwr.readSync() == 1 ? 'pwr on' : 'pwr off';
        let rgb = `r:${this.redLED.readSync()}  g:${this.greenLED.readSync()}  b:${this.blueLED.readSync()}`;
        this.logger.info(`[Touch-Buttons] ${this.STATE.padEnd(20)}> relay_mute:${rmute}  relay_amp:${rpwr}  {${rgb}}`);        
    };

    muteAmp(muteOn = true) {
        this.relay_mute.writeSync(muteOn == false ? 1 : 0);
    };

    pwrAmp(on = true) {
        this.relay_amp_pwr.writeSync(on ? 1 : 0);
    };

}


module.exports = {
    LedAmpState,
    PAUSED, RADIO, SPOTIFY_1, SPOTIFY_2, NAS, START_UP, RESTORE,
    RADIO_PENDING,SPOTIFY_1_PENDING,SPOTIFY_2_PENDING,NAS_PENDING,CONFIRM
};