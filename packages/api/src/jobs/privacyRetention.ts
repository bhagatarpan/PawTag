/**
 * @module Finder Privacy Retention
 * @description Configuration and cleanup for Finder data retention.
 *
 * PawTag collects sensitive finder data during pet recovery:
 * - Finder contact information (phone, email, name)
 * - GPS location (when finder explicitly shares)
 * - IP-based approximate location
 * - Device information
 * - Consent records
 *
 * This module defines retention periods and cleanup mechanisms to ensure
 * data is not kept longer than necessary while respecting:
 * - Active incident requirements
 * - Legal/audit obligations
 * - Operational needs
 *
 * Retention policy:
 * - Finder contact info: Anonymize 30 days after incident resolution
 * - GPS location: Anonymize 30 days after incident resolution
 * - IP location: Retain 90 days for analytics, then anonymize
 * - Device info: Retain 90 days for analytics, then anonymize
 * - Consent records: Retain 1 year for legal compliance
 * - Escalation records: Retain 1 year for operational audit
 *
 * This policy should be reviewed with a privacy/legal professional.
 */

import { FinderScan, LocationEvent, EscalationRecord } from '@pawtag/db';
import logger from '../lib/logger';

/**
 * Retention periods in days.
 * These are intentionally conservative for MVP.
 */
export const RETENTION_CONFIG = {
  /** Days after incident resolution to anonymize finder contact info */
  finderContactRetentionDays: 30,

  /** Days after incident resolution to anonymize GPS location */
  gpsLocationRetentionDays: 30,

  /** Days to retain IP-based location for analytics */
  ipLocationRetentionDays: 90,

  /** Days to retain device info for analytics */
  deviceInfoRetentionDays: 90,

  /** Days to retain consent records for legal compliance */
  consentRetentionDays: 365,

  /** Days to retain escalation records for operational audit */
  escalationRetentionDays: 365,
} as const;

/**
 * Anonymize finder contact information in a FinderScan record.
 * Replaces phone, email, and name with anonymized placeholders.
 */
async function anonymizeFinderContact(scanId: string): Promise<void> {
  await FinderScan.findByIdAndUpdate(scanId, {
    $set: {
      finderPhone: '[anonymized]',
      finderEmail: '[anonymized]',
      finderName: '[anonymized]',
      'consent.ipAddress': '[anonymized]',
    },
  });
}

/**
 * Anonymize GPS location in a FinderScan record.
 * Replaces precise coordinates with null.
 */
async function anonymizeGpsLocation(scanId: string): Promise<void> {
  await FinderScan.findByIdAndUpdate(scanId, {
    $unset: {
      gpsLocation: '',
      location: '',
    },
  });
}

/**
 * Anonymize IP-based location in a FinderScan record.
 * Removes approximate coordinates while keeping country for analytics.
 */
async function anonymizeIpLocation(scanId: string): Promise<void> {
  await FinderScan.findByIdAndUpdate(scanId, {
    $unset: {
      'ipLocation.latitude': '',
      'ipLocation.longitude': '',
      'ipLocation.city': '',
      'ipLocation.region': '',
    },
  });
}

/**
 * Anonymize device information in a FinderScan record.
 */
async function anonymizeDeviceInfo(scanId: string): Promise<void> {
  await FinderScan.findByIdAndUpdate(scanId, {
    $set: {
      deviceInfo: '[anonymized]',
      deviceBrowser: '[anonymized]',
      deviceOS: '[anonymized]',
    },
  });
}

/**
 * Anonymize GPS location in an EscalationRecord.
 */
async function anonymizeEscalationLocation(recordId: string): Promise<void> {
  await EscalationRecord.findByIdAndUpdate(recordId, {
    $unset: {
      scanLocation: '',
    },
    $set: {
      finderPhone: '[anonymized]',
      finderEmail: '[anonymized]',
      finderName: '[anonymized]',
      finderMessage: '[anonymized]',
    },
  });
}

/**
 * Anonymize GPS location in a LocationEvent record.
 */
async function anonymizeLocationEvent(eventId: string): Promise<void> {
  await LocationEvent.findByIdAndUpdate(eventId, {
    $unset: {
      'location.latitude': '',
      'location.longitude': '',
    },
    $set: {
      'location.accuracy': null,
    },
  });
}

/**
 * Run the privacy retention cleanup job.
 *
 * This job:
 * 1. Finds resolved escalation records older than retention period
 * 2. Anonymizes finder contact info and GPS location
 * 3. Anonymizes old IP locations and device info
 *
 * Should run daily via a scheduled job.
 */
export async function runPrivacyRetentionCleanup(): Promise<{
  finderContactsAnonymized: number;
  gpsLocationsAnonymized: number;
  ipLocationsAnonymized: number;
  deviceInfoAnonymized: number;
  escalationRecordsAnonymized: number;
  locationEventsAnonymized: number;
}> {
  const now = new Date();
  const results = {
    finderContactsAnonymized: 0,
    gpsLocationsAnonymized: 0,
    ipLocationsAnonymized: 0,
    deviceInfoAnonymized: 0,
    escalationRecordsAnonymized: 0,
    locationEventsAnonymized: 0,
  };

  try {
    // 1. Anonymize finder contact info for resolved incidents
    const contactCutoff = new Date(now.getTime() - RETENTION_CONFIG.finderContactRetentionDays * 24 * 60 * 60 * 1000);
    const resolvedEscalations = await EscalationRecord.find({
      status: { $in: ['resolved', 'owner_responded'] },
      resolvedAt: { $lte: contactCutoff, $ne: null },
    }).select('finderScanId');

    for (const esc of resolvedEscalations) {
      if (esc.finderScanId) {
        await anonymizeFinderContact(String(esc.finderScanId));
        results.finderContactsAnonymized++;
      }
    }

    // 2. Anonymize GPS locations for resolved incidents
    const gpsCutoff = new Date(now.getTime() - RETENTION_CONFIG.gpsLocationRetentionDays * 24 * 60 * 60 * 1000);
    const gpsEscalations = await EscalationRecord.find({
      status: { $in: ['resolved', 'owner_responded'] },
      resolvedAt: { $lte: gpsCutoff, $ne: null },
    }).select('finderScanId');

    for (const esc of gpsEscalations) {
      if (esc.finderScanId) {
        await anonymizeGpsLocation(String(esc.finderScanId));
        results.gpsLocationsAnonymized++;
      }
    }

    // 3. Anonymize old IP locations
    const ipCutoff = new Date(now.getTime() - RETENTION_CONFIG.ipLocationRetentionDays * 24 * 60 * 60 * 1000);
    const oldIpScans = await FinderScan.find({
      createdAt: { $lte: ipCutoff },
      'ipLocation.latitude': { $exists: true, $ne: null },
    }).select('_id');

    for (const scan of oldIpScans) {
      await anonymizeIpLocation(String(scan._id));
      results.ipLocationsAnonymized++;
    }

    // 4. Anonymize old device info
    const deviceCutoff = new Date(now.getTime() - RETENTION_CONFIG.deviceInfoRetentionDays * 24 * 60 * 60 * 1000);
    const oldDeviceScans = await FinderScan.find({
      createdAt: { $lte: deviceCutoff },
      deviceInfo: { $ne: '[anonymized]' },
    }).select('_id');

    for (const scan of oldDeviceScans) {
      await anonymizeDeviceInfo(String(scan._id));
      results.deviceInfoAnonymized++;
    }

    // 5. Anonymize old escalation records
    const escCutoff = new Date(now.getTime() - RETENTION_CONFIG.escalationRetentionDays * 24 * 60 * 60 * 1000);
    const oldEscalations = await EscalationRecord.find({
      createdAt: { $lte: escCutoff },
      status: { $in: ['resolved', 'owner_responded'] },
    }).select('_id');

    for (const esc of oldEscalations) {
      await anonymizeEscalationLocation(String(esc._id));
      results.escalationRecordsAnonymized++;
    }

    // 6. Anonymize old location events
    const locationCutoff = new Date(now.getTime() - RETENTION_CONFIG.gpsLocationRetentionDays * 24 * 60 * 60 * 1000);
    const oldLocations = await LocationEvent.find({
      createdAt: { $lte: locationCutoff },
      'location.latitude': { $exists: true, $ne: null },
    }).select('_id');

    for (const loc of oldLocations) {
      await anonymizeLocationEvent(String(loc._id));
      results.locationEventsAnonymized++;
    }

    logger.info(results, 'Privacy retention cleanup completed');
  } catch (err) {
    logger.error({ err }, 'Privacy retention cleanup failed');
  }

  return results;
}

/**
 * Run the privacy retention job. Called by the job scheduler.
 */
export async function runPrivacyRetentionJob(): Promise<import('../services/job-scheduler.service').JobResult> {
  try {
    const results = await runPrivacyRetentionCleanup();
    const total = results.finderContactsAnonymized + results.gpsLocationsAnonymized +
      results.ipLocationsAnonymized + results.deviceInfoAnonymized +
      results.escalationRecordsAnonymized + results.locationEventsAnonymized;
    return { success: true, itemsProcessed: total };
  } catch (error: any) {
    logger.error({ err: error }, '[PrivacyRetentionJob] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}
