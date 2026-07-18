package com.pawtag.pawtag

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "findmy"
    private var eventChannel: EventChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "startLocationTracking") {
                // FindMyServiceAndroid.startLocationTracking() placeholder
                result.success(null)
            } else {
                result.notImplemented()
            }
        }

        eventChannel = EventChannel(flutterEngine.dartExecutor.binaryMessenger, "location_update")
        eventChannel?.setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, sink: EventChannel.EventSink) {
                setLocationUpdateListener { locationData ->
                    sink.success(locationData)
                }
            }

            override fun onCancel(arguments: Any?) {
                removeLocationUpdateListener()
            }
        })
    }

    companion object {
        private var updateListener: ((String) -> Unit)? = null

        @JvmStatic
        fun setLocationUpdateListener(listener: (String) -> Unit) {
            updateListener = listener
        }

        @JvmStatic
        fun removeLocationUpdateListener() {
            updateListener = null
        }
        
        fun dispatchLocationUpdate(locationData: String) {
            updateListener?.invoke(locationData)
        }
    }
}
