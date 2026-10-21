import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../documents/data/repositories/documents_repository.dart';
import '../../../home/presentation/providers/dashboard_provider.dart';
import '../../data/models/maintenance_report.dart';
import '../../data/repositories/maintenance_repository.dart';

/// Reportes de la casa del cliente (abiertos primero, como los ordena la API).
final maintenanceReportsProvider = FutureProvider.family<List<MaintenanceReport>, String>(
  (ref, propertyId) => ref.watch(maintenanceRepositoryProvider).list(propertyId: propertyId),
);

final maintenanceReportProvider = FutureProvider.family<MaintenanceReport, String>((ref, id) => ref.watch(maintenanceRepositoryProvider).get(id));

final newReportProvider = Provider<NewReportAction>(NewReportAction.new);

/// Sube las fotos (máx. 5) y crea el reporte; después refresca la lista y el panel.
class NewReportAction {
  NewReportAction(this._ref);

  final Ref _ref;

  Future<MaintenanceReport> submit({
    required String propertyId,
    required String title,
    required String description,
    required String category,
    required String priority,
    List<XFile> photos = const [],
  }) async {
    final docs = _ref.read(documentsRepositoryProvider);
    final keys = <String>[];
    for (final p in photos) {
      keys.add(await docs.uploadMaintenancePhoto(propertyId, p));
    }
    final report = await _ref.read(maintenanceRepositoryProvider).create(
          propertyId: propertyId,
          title: title,
          description: description,
          category: category,
          priority: priority,
          photos: keys,
        );
    _ref.invalidate(maintenanceReportsProvider(propertyId));
    _ref.invalidate(clientDashboardProvider);
    return report;
  }
}
