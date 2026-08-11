import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../dummy/dummy_data.dart';
import '../models/models.dart';
import '../repositories/repositories.dart';

class AppState extends ChangeNotifier {
  AppState({
    AuthRepository? authRepository,
    BagRepository? bagRepository,
    OrderRepository? orderRepository,
  }) : authRepository = authRepository ?? DummyAuthRepository(),
       bagRepository = bagRepository ?? DummyBagRepository(),
       orderRepository = orderRepository ?? DummyOrderRepository();

  final AuthRepository authRepository;
  final BagRepository bagRepository;
  final OrderRepository orderRepository;

  bool isAuthenticated = false;
  bool onboardingSeen = false;
  BagCategory selectedCategory = BagCategory.all;
  final Set<String> favoriteIds = <String>{DummyData.bags[2].id};
  List<SurpriseBag> bags = <SurpriseBag>[];
  AppOrder? activeOrder;
  final List<AppOrder> orderHistory = <AppOrder>[];

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    onboardingSeen = prefs.getBool('onboarding_seen') ?? false;
    final saved = prefs.getStringList('favorite_ids');
    if (saved != null) {
      favoriteIds
        ..clear()
        ..addAll(saved);
    }
    try {
      bags = await bagRepository.nearby();
    } catch (_) {
      bags = DummyData.bags;
    }
  }

  Future<void> completeOnboarding() async {
    onboardingSeen = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_seen', true);
    notifyListeners();
  }

  Future<void> signInWithEmail(String email, String password) async {
    await authRepository.signInWithEmail(email, password);
    isAuthenticated = true;
    notifyListeners();
  }

  Future<void> signInWithProvider(String provider) async {
    await authRepository.signInWithProvider(provider);
    isAuthenticated = true;
    notifyListeners();
  }

  Future<void> signOut() async {
    await authRepository.signOut();
    isAuthenticated = false;
    notifyListeners();
  }

  void selectCategory(BagCategory category) {
    selectedCategory = category;
    notifyListeners();
  }

  List<SurpriseBag> get filteredBags {
    if (selectedCategory == BagCategory.all) return bags;
    return bags.where((bag) => bag.category == selectedCategory).toList();
  }

  List<SurpriseBag> get favoriteBags =>
      bags.where((bag) => favoriteIds.contains(bag.id)).toList();

  Future<void> toggleFavorite(String id) async {
    if (!favoriteIds.add(id)) favoriteIds.remove(id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('favorite_ids', favoriteIds.toList());
    notifyListeners();
  }

  Future<AppOrder> createOrder(SurpriseBag bag, int quantity) async {
    final order = await orderRepository.create(bag, quantity);
    activeOrder = order;
    notifyListeners();
    return order;
  }

  Future<AppOrder?> completePickup() async {
    if (activeOrder == null) return null;
    activeOrder = await orderRepository.confirmPickup(activeOrder!);
    orderHistory.insert(0, activeOrder!);
    notifyListeners();
    return activeOrder;
  }

  Future<AppOrder?> cancelActiveOrder() async {
    final currentOrder = activeOrder;
    if (currentOrder == null) return null;
    final cancelledOrder = await orderRepository.cancel(currentOrder);
    orderHistory.insert(0, cancelledOrder);
    activeOrder = null;
    notifyListeners();
    return cancelledOrder;
  }

  SurpriseBag bagById(String id) => bags.firstWhere((bag) => bag.id == id);
}
