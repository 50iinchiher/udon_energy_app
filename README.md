# ThermoTrack

ThermoTrack is an Expo mobile dashboard for monitoring energy collected from a thermoelectric generator (TEG) and a small turbine.

## Hardware

The app polls an ESP32 `/data` endpoint every 2 seconds. The firmware template is in [firmware/esp32_energy_server.ino](firmware/esp32_energy_server.ino) and reads two INA219 sensors:

- TEG: I2C address `0x40`
- Turbine: I2C address `0x41`
- I2C: SDA `GPIO8`, SCL `GPIO9`

### ESP32 setup

1. Install the `Adafruit INA219` library in Arduino IDE.
2. Set `WIFI_SSID` and `WIFI_PASSWORD` in the firmware, then upload it to the ESP32-S3.
3. Connect the second INA219 A0/A1 address pins so it is really `0x41`.
4. Open Serial Monitor at `115200` and copy the printed ESP32 IP address.
5. Put the computer, phone, and ESP32 on the same 2.4 GHz hotspot.

The app accepts the older flat response (`voltage`, `current`, `power`) and the current response with `teg`, `turbine`, and `total_power_mW` fields.

## Run the app

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npx expo start --lan
   ```

Scan the QR code with Expo Go. Keep the computer and phone on the same Wi-Fi network.

## Validation

Run the linter before submitting changes:

```bash
npm run lint
```

The project uses Expo Router and supports Expo Go, Android, iOS, and web development.
