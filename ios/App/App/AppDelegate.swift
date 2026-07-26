import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Firebase only when GoogleService-Info.plist is bundled.
        // Lets the IPA build & launch even before the plist is provisioned in Codemagic;
        // FCM activates automatically once the plist lands in the app bundle.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
        }
        // Deliberately NOT claiming UNUserNotificationCenter.current().delegate.
        //
        // Capacitor owns that slot: CapacitorBridge sets it to its NotificationRouter
        // when the bridge is built (`ios.handleApplicationNotifications`, default YES
        // and not overridden in capacitor.config.json), and the router is what forwards
        // a TAP to @capacitor/push-notifications → `pushNotificationActionPerformed` →
        // lib/driver/native-push.ts, which navigates the WebView to the push's data.url.
        //
        // This delegate used to be assigned here while the class implemented only
        // `willPresent` and never `didReceive(response:)`. That was survivable purely
        // by UIKit ordering luck — the bridge is constructed after
        // didFinishLaunchingWithOptions returns, so Capacitor reclaimed the slot and
        // taps kept working. Had this ever won the race (a Capacitor upgrade, scene
        // lifecycle adoption), every notification tap would have been swallowed in
        // silence: no event to JS, no navigation, the app just opening.
        //
        // Foreground presentation is unchanged — the plugin's own willPresent returns
        // the `presentationOptions` from capacitor.config.json (badge/sound/alert),
        // exactly what the removed implementation hardcoded, and it additionally emits
        // `pushNotificationReceived` to JS, which this one never did.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - APNs token → forward to Firebase + Capacitor PushNotifications plugin

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    // MARK: - FCM token → re-emit as a Capacitor "registration" event so the JS layer
    //         receives an FCM token (matching the Android behavior), not a raw APNs token.

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken = fcmToken,
              let tokenData = fcmToken.data(using: .utf8) else { return }
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: tokenData
        )
    }

}
