# bespoke-home-hifi

Bespoke home built hifi using, amongst other things

- volumio.io for the media player
    - with custom written plugin
- Adafruit touch controller
- Pi Zero2 W
- HiFiBerry
- Witty Power Mini v3
- Amplifier link
- Upcycled parts
    - Oak case made from old dinning table
    - Old laptop case
    - Kitchen hinge covers for touch buttons
    - Slate for knobs and styling found in our drive
    - ... plus random componets, circuit boards etc.

## Raspberry PI Configuration

### Pi Hardware

Originally this was run on a Pi Zero W; but always felt a little sluggish. It worked but the UI was always lagging behind. Felt that it was struggling as well when playing and SSH in doing development. 

Pi Zero 2 W became available - with the extra processing power this has been working a lot better and feels more responsive. Quad core vs Single core makes a big difference. [PiHut Link](https://thepihut.com/products/raspberry-pi-zero-2)


### Witty Pi Power Management

A [WittyPi v3 mini](https://www.uugear.com/product/witty-pi-3-mini-realtime-clock-and-power-management-for-raspberry-pi/) power controller was used - this is used to control the power on and off; the thing to watch with installing this is that the installer needs to have tools such as `unzip` `i2c-detect` available - so it took a couple of attempts to install this. Straightforward (if you can code bash and are aware of with installing packages!)

This has now been replaced by the v4 - which now includes a temperature sensor that would have been useful; not completely sure yet how much heat will be gnerated. None of the of the power schedule features are being used however.

### Audio 

The [HiFiBerry DAC+ Zero](https://thepihut.com/products/hifiberry-dac-zero) was used; one of the more basic audio boards. No inbuilt volume or amplifier. This was perfectly fine as volumio does the volume.  Possibly not the highest audio quality and doesn't seem to be available now but there are variety of options available. 

Configuration of this with Volumio was simple - it wsa one of the known DACs in the configuration

### PiZero Breakout

To interface with the other components, access to the other GPIO pins was needed. The [Breakout PiZero Addon](https://thepihut.com/products/breakout-pizero?variant=26469075144) was used successfully (on the second attempt). Should you use on of these be very very clear which way up the board should go; get it upside down and the magic blue smoke will be let loose. 

## Volumio

Volumio version 3 was installed on a SD 'in the usual manner'; this is a debian based image so very familar.
No particular issues save the sluggish interface on the older Pi but that's not the fault of either.

There are 3 plugins added to Volumio; Spotify and the Rotary Encoder are easily installed. Note that the Spotify one really needs the paid version of Spotify to work well. The Rotary Encoder likewise was easy to configure in the software - but the hardware needed a little work.  

The final plugin was the custom one to manage the the buttons and the overall 'bespoke' aspects. See the specific [volumio information](./volumio.md)



