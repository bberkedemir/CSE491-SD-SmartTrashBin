"""
Smart Waste Bin BLE Gateway
Receives sensor data via BLE and stores in database
"""

import asyncio
import struct
import sqlite3
from datetime import datetime
from bleak import BleakScanner
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DB_PATH = "sensor_data.db"

# RSSI threshold (signal strength)
RSSI_THRESHOLD = -85  # Ignore weak signals


class BinDataGateway:
    """Gateway for receiving and processing bin sensor data"""
    
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.setup_database()
    
    def setup_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create sensor_data table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bin_id TEXT NOT NULL,
                fill_level INTEGER NOT NULL,
                battery_voltage REAL NOT NULL,
                rssi INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                sensor_timestamp INTEGER,
                UNIQUE(bin_id, sensor_timestamp)
            )
        ''')
        
        # Create index for faster queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_bin_timestamp 
            ON sensor_data(bin_id, timestamp DESC)
        ''')
        
        conn.commit()
        conn.close()
        logger.info("Database initialized")
    
    def parse_manufacturer_data(self, manufacturer_data):
        """
        Parse manufacturer data from BLE advertisement
        Format: [BIN_ID(6), FILL(1), VOLTAGE(2), TIMESTAMP(4)]
        """
        try:
            if len(manufacturer_data) < 13:
                return None
            
            # Extract bin ID (6 bytes)
            bin_id = manufacturer_data[0:6].decode('utf-8', errors='ignore').strip()
            
            # Extract fill level (1 byte)
            fill_level = manufacturer_data[6]
            
            # Extract voltage (2 bytes, little-endian)
            voltage_mv = struct.unpack('<H', manufacturer_data[7:9])[0]
            voltage = voltage_mv / 1000.0
            
            # Extract sensor timestamp (4 bytes, little-endian)
            sensor_timestamp = struct.unpack('<I', manufacturer_data[9:13])[0]
            
            return {
                'bin_id': bin_id,
                'fill_level': fill_level,
                'battery_voltage': voltage,
                'sensor_timestamp': sensor_timestamp
            }
        except Exception as e:
            logger.error(f"Error parsing manufacturer data: {e}")
            return None
    
    def store_sensor_data(self, data, rssi):
        """Store sensor data in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR IGNORE INTO sensor_data 
                (bin_id, fill_level, battery_voltage, rssi, sensor_timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                data['bin_id'],
                data['fill_level'],
                data['battery_voltage'],
                rssi,
                data['sensor_timestamp']
            ))
            
            if cursor.rowcount > 0:
                logger.info(
                    f"Stored: {data['bin_id']} - "
                    f"Fill: {data['fill_level']}% - "
                    f"Battery: {data['battery_voltage']:.2f}V - "
                    f"RSSI: {rssi}dBm"
                )
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error storing data: {e}")
    
    def detection_callback(self, device, advertisement_data):
        """Callback for BLE device detection"""
        try:
            # Check RSSI threshold
            rssi = advertisement_data.rssi
            if rssi < RSSI_THRESHOLD:
                return
            
            # Check for manufacturer data
            if not advertisement_data.manufacturer_data:
                return
            
            # Get manufacturer data (typically key is company ID)
            for company_id, data in advertisement_data.manufacturer_data.items():
                parsed_data = self.parse_manufacturer_data(data)
                
                if parsed_data:
                    # Check for valid bin ID prefix
                    if parsed_data['bin_id'].startswith('VAR_'):
                        self.store_sensor_data(parsed_data, rssi)
        
        except Exception as e:
            logger.error(f"Error in detection callback: {e}")
    
    async def start_scanning(self):
        """Start continuous BLE scanning"""
        logger.info("Starting BLE scanning...")
        
        scanner = BleakScanner(detection_callback=self.detection_callback)
        
        while True:
            try:
                await scanner.start()
                await asyncio.sleep(60)  # Scan for 60 seconds
                await scanner.stop()
                
                logger.info("Scan cycle completed. Restarting...")
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Scanning error: {e}")
                await asyncio.sleep(5)
    
    def get_latest_readings(self):
        """Get latest reading for each bin"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT bin_id, fill_level, battery_voltage, 
                   timestamp, rssi
            FROM sensor_data s1
            WHERE timestamp = (
                SELECT MAX(timestamp) 
                FROM sensor_data s2 
                WHERE s2.bin_id = s1.bin_id
            )
            ORDER BY bin_id
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return results
    
    def get_bin_history(self, bin_id, hours=24):
        """Get historical data for a specific bin"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT fill_level, battery_voltage, timestamp, rssi
            FROM sensor_data
            WHERE bin_id = ?
            AND timestamp >= datetime('now', '-' || ? || ' hours')
            ORDER BY timestamp DESC
        ''', (bin_id, hours))
        
        results = cursor.fetchall()
        conn.close()
        
        return results


def main():
    """Main function to run the gateway"""
    gateway = BinDataGateway()
    
    try:
        # Start scanning
        asyncio.run(gateway.start_scanning())
    except KeyboardInterrupt:
        logger.info("Gateway stopped by user")
    except Exception as e:
        logger.error(f"Gateway error: {e}")


if __name__ == "__main__":
    main()