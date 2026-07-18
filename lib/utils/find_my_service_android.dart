import 'package:flutter/services.dart';

class FindMyServiceAndroid {
  static const MethodChannel _channel = MethodChannel('findmy');
  static const EventChannel _eventChannel = EventChannel('location_update');
  
  static void setLocationUpdateListener(void Function(String locationData) onLocationUpdate) {
    _eventChannel.receiveBroadcastStream().listen((dynamic event) {
      if (event is String) {
        onLocationUpdate(event);
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
    print("Location Update from Android: $locationData");
  }
}
