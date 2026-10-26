import UIKit
import Capacitor
import WebKit
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
        // by UIKit ordering luck - the bridge is constructed after
        // didFinishLaunchingWithOptions returns, so Capacitor reclaimed the slot and
        // taps kept working. Had this ever won the race (a Capacitor upgrade, scene
        // lifecycle adoption), every notification tap would have been swallowed in
        // silence: no event to JS, no navigation, the app just opening.
        //
        // Foreground presentation is unchanged - the plugin's own willPresent returns
        // the `presentationOptions` from capacitor.config.json (badge/sound/alert),
        // exactly what the removed implementation hardcoded, and it additionally emits
        // `pushNotificationReceived` to JS, which this one never did.
        startLoadWatchdog()
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
        // Hand the page the FCM token on EVERY register() call, not only when
        // Firebase first issues or rotates it.
        //
        // didReceiveRegistrationToken (below) fires once, early in launch. The
        // page loads remotely and attaches its `registration` listener later, so
        // on most launches that event reached nobody, and register() produced
        // only the APNs token above, which driver/native-push.ts ignores. A phone
        // whose token never changed therefore never re-registered, and the server
        // kept the shell version it reported months earlier (2026-10-25..26:
        // 89 Android driver /fcm/subscribe calls, 1 from iOS). Same fix as
        // orest-express-mobile a2462d1. Once the APNs token is set,
        // token(completion:) answers from the cache.
        Messaging.messaging().token { token, _ in
            guard let token = token, let tokenData = token.data(using: .utf8) else { return }
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: .capacitorDidRegisterForRemoteNotifications,
                    object: tokenData
                )
            }
        }
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

    // MARK: - Stalled-load watchdog
    //
    // `server.errorPath` (offline.html) covers a load that FAILS: Capacitor hands
    // over to the local page from didFail / didFailProvisionalNavigation. It does
    // nothing for a load that merely HANGS - a captive portal, or one bar of LTE
    // that completes the handshake and then goes quiet. WebKit sits on that for
    // its full ~60s timeout before it reports anything, and for those 60 seconds
    // the WebView paints nothing but `backgroundColor`. That is the same black
    // screen, just on a slower fuse.
    //
    // So measure the load here. This is a STALL detector, not a deadline: any
    // forward movement in estimatedProgress restarts the clock, so a slow but
    // living connection is left alone for as long as it needs. Only a load that
    // has not advanced AT ALL for `stalledLoadSeconds` is given up on.
    //
    // It guards the FIRST load and disarms permanently once one completes. After
    // that the user has real content on screen, and replacing it with an error
    // page would be strictly worse than letting them wait. Every later attempt
    // belongs to offline.html, which times out its own hop back.

    private static let stalledLoadSeconds: TimeInterval = 30
    private static let watchdogGiveUpSeconds: TimeInterval = 120

    private var loadWatchdog: Timer?
    private var watchdogArmedAt: TimeInterval = 0
    private var watchdogLastProgress: Double = 0
    private var watchdogClockStartedAt: TimeInterval = 0
    private var watchdogFinished = false

    private func startLoadWatchdog() {
        loadWatchdog?.invalidate()
        watchdogArmedAt = ProcessInfo.processInfo.systemUptime
        watchdogLastProgress = 0
        watchdogClockStartedAt = 0
        watchdogFinished = false

        // .common mode so the tick survives any tracking run loop the splash
        // screen or an early touch might put the main loop into.
        let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.checkForStalledLoad()
        }
        RunLoop.main.add(timer, forMode: .common)
        loadWatchdog = timer
    }

    private func stopLoadWatchdog() {
        watchdogFinished = true
        loadWatchdog?.invalidate()
        loadWatchdog = nil
    }

    private func checkForStalledLoad() {
        guard !watchdogFinished else { stopLoadWatchdog(); return }

        let now = ProcessInfo.processInfo.systemUptime

        // The bridge is built after didFinishLaunchingWithOptions returns, so the
        // first tick or two legitimately find nothing. Keep waiting - and do not
        // start the stall clock until there is actually a load to measure.
        guard let controller = window?.rootViewController as? CAPBridgeViewController,
              let webView = controller.webView else {
            if now - watchdogArmedAt >= AppDelegate.watchdogGiveUpSeconds { stopLoadWatchdog() }
            return
        }
        guard let errorURL = controller.bridge?.config.errorPathURL else {
            stopLoadWatchdog()  // no errorPath configured, so there is nowhere to go
            return
        }

        if watchdogClockStartedAt == 0 { watchdogClockStartedAt = now }

        // ANY change in estimatedProgress is evidence of life, in either direction.
        //
        // It used to only count progress going UP, which made watchdogLastProgress a
        // high-water mark that could never be beaten again once a SECOND navigation
        // started mid-boot - and estimatedProgress restarts near 0 for a new
        // navigation, so it never climbed back above the old mark until the very end.
        // The stall clock therefore stayed frozen at the previous navigation's last
        // tick and the fuse burned down while the new page was loading normally.
        //
        // A push-tap deep link does exactly this: handlePushTap fires as soon as the
        // tap listener attaches, mid-boot, and calls window.location.assign(), which
        // is a full document navigation. Tapping a "Trip off route" alert therefore
        // reliably produced a black screen and then the offline page, while the same
        // app cold-started from the icon was fine.
        let progress = webView.estimatedProgress
        if progress != watchdogLastProgress {
            watchdogLastProgress = progress
            watchdogClockStartedAt = now
        }

        // Document loaded: stand down for good. Parity with Android's
        // `if (progress >= 100) stopLoadWatchdog()`.
        //
        // This used to also require `!webView.isLoading`, and that extra condition was
        // the bug. isLoading stays true while subresources stream, and this app pulls
        // ~2 MB across 33 chunks after the document lands. Meanwhile the clock above
        // only restarts on a NEW progress high-water mark, so once estimatedProgress
        // plateaued at 1.0 the fuse could never be reset: a first load that was working
        // fine got killed at stalledLoadSeconds and replaced with the offline page.
        // Reported as a black screen followed by "No internet connection" on Wi-Fi,
        // while the same network served the same site to Safari without trouble.
        //
        // Whatever is still streaming once the document is in is the app's own payload,
        // not a hang. A genuine hang never advances progress at all, so the stall clock
        // below still catches it.
        if progress >= 1.0 {
            stopLoadWatchdog()
            return
        }

        guard now - watchdogClockStartedAt >= AppDelegate.stalledLoadSeconds else { return }

        stopLoadWatchdog()
        webView.stopLoading()
        webView.load(URLRequest(url: errorURL))
    }

}

// MARK: - Distribution channel in the user agent
//
// The web app (served live from orestexpress.online) has to tell a TestFlight
// install from an App Store one: drivers still on the beta are told to delete it
// and install the App Store build, because a TestFlight build expires after 90
// days and the App Store will not update over it. JS cannot read the receipt, so
// the shell states it once, as a user-agent token: `RRDist/appstore`,
// `RRDist/testflight` or `RRDist/dev`. A UA token rather than a plugin because it
// also lands in the server's access log, which is how installs get counted.
//
// Shells before 1.5 send no token at all; the web treats that as "unknown".
enum DistributionChannel {
    static let current: String = {
        #if DEBUG
        return "dev"
        #else
        // Ad-hoc and development signing embed their provisioning profile;
        // App Store and TestFlight builds never do.
        if Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") != nil {
            return "dev"
        }
        // A TestFlight install carries a sandbox receipt, the App Store a real one.
        if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" {
            return "testflight"
        }
        return "appstore"
        #endif
    }()
}

// Main.storyboard instantiates this instead of CAPBridgeViewController. It is
// still a CAPBridgeViewController, so the load watchdog's cast above holds.
class DriverBridgeViewController: CAPBridgeViewController {
    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        let token = "RRDist/\(DistributionChannel.current)"
        if let existing = descriptor.appendedUserAgentString, !existing.isEmpty {
            descriptor.appendedUserAgentString = "\(existing) \(token)"
        } else {
            descriptor.appendedUserAgentString = token
        }
        return descriptor
    }
}
