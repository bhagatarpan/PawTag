import 'package:flutter/material.dart';
import 'package:pawtag/features/recovery/models/owner_dashboard.dart';
import 'package:pawtag/features/recovery/models/pawtag_profile.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pawtag/pages/auth_page.dart';

void main() {
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Create a mock profile for testing the UI
    const dummyProfile = PawTagProfile(
      tagId: 'PT-123456',
      petName: 'Bella',
      photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200',
      medicalAlerts: 'Allergic to chicken',
      isLost: true,
    );

    return MaterialApp(
      title: 'PawTag',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.teal,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const AuthPage(),
        '/dashboard': (context) => const OwnerDashboardScreen(profile: dummyProfile),
      },
    );
  }
}
