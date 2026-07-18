import 'package:flutter/services.dart';

class FindMyServiceIOS {
  static const MethodChannel _channel = MethodChannel('findmy');

  static void setLocationUpdateListener(void Function(String locationData) onLocationUpdate) {
    // iOS might use a method channel callback rather than an event channel based on the provided Swift code
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'locationUpdate') {
        onLocationUpdate(call.arguments as String);
      }
    });
  }

  Future<void> startLocationTracking() async {
    try {
      await _channel.invokeMethod('startLocationTracking');
    } on PlatformException catch (e) {
      print("Failed to start location tracking: ${e.message}");
    }
  }

  static void handleLocationUpdate(String locationData) {
    // Handle the location update here
    print("Location Update from iOS: $locationData");
  }
}
