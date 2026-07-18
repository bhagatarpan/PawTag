import 'package:flutter/material.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:pawtag/features/recovery/models/pawtag_profile.dart';

part 'finder_portal.freezed.dart';
part 'finder_portal.g.dart';

@freezed
abstract class FinderPortal with _$FinderPortal {
  const factory FinderPortal({
    required PawTagProfile profile,
  }) = _FinderPortal;

  factory FinderPortal.fromJson(Map<String, dynamic> json) => _$FinderPortalFromJson(json);
}

class FinderPortalScreen extends StatelessWidget {
  final PawTagProfile profile;

  const FinderPortalScreen({super.key, required this.profile});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PawTag - Find My Pet')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.network(profile.photoUrl),
            const SizedBox(height: 20),
            Text('Pet Name: ${profile.petName}'),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // Implement Notify Owner logic here
              },
              child: const Text('Notify Owner'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // Implement GPS Share logic here
              },
              child: const Text('Share Location'),
            ),
          ],
        ),
      ),
    );
  }
}
