import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let methodChannel = FlutterMethodChannel(name: "findmy", binaryMessenger: controller.binaryMessenger)
    methodChannel.setMethodCallHandler({
      (call, result) -> Void in
      if call.method == "startLocationTracking" {
        // FindMyServiceiOS.startLocationTracking() placeholder
        result.success(nil)
      } else {
        result.notImplemented()
      }
    })
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    let controller = window?.rootViewController as! FlutterViewController
    let methodChannel = FlutterMethodChannel(name: "findmy", binaryMessenger: controller.binaryMessenger)
    methodChannel.invokeMethod("locationUpdate", arguments: url.absoluteString)
    return true
  }

  override func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    if let locationData = userActivity.webpageURL?.absoluteString {
      let controller = window?.rootViewController as! FlutterViewController
      let methodChannel = FlutterMethodChannel(name: "findmy", binaryMessenger: controller.binaryMessenger)
      methodChannel.invokeMethod("locationUpdate", arguments: locationData)
    }
    return true
  }

  override func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
    if #available(iOS 12.0, *) {
      return .allButUpsideDown
    } else {
      return .all
    }
  }
}
