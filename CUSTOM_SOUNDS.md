# Custom notification sounds

Drop `.mp3` or `.ogg` files here, then reference them in MainActivity.java:

```java
Uri uri = Uri.parse("android.resource://" + getPackageName() + "/raw/<filename_without_ext>");
channel.setSound(uri, audioAttributes);
```

Conventions:
- Length: 2–8 seconds (Android cuts off longer sounds at notification time).
- Format: `.mp3` (broadest support) or `.ogg` (smaller file).
- Naming: lowercase, alphanumeric + underscore. e.g. `load_assigned.mp3`,
  `urgent_alert.mp3`, `dispatcher_msg.mp3`.

Recommended free CC0 sources:
- pixabay.com/sound-effects (filter: notifications, ≤10s)
- freesound.org (filter by Creative Commons 0)
