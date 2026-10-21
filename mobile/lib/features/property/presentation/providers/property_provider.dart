import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/property_models.dart';
import '../../data/repositories/property_repository.dart';

final propertyDetailProvider = FutureProvider.family<PropertyDetail, String>((ref, id) => ref.watch(propertyRepositoryProvider).get(id));

final dossierProvider = FutureProvider.family<Dossier, String>((ref, id) => ref.watch(propertyRepositoryProvider).dossier(id));

final catalogProvider = FutureProvider<List<PropertyDetail>>((ref) => ref.watch(propertyRepositoryProvider).catalog());
