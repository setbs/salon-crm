@startuml
left to right direction
title Diagram przypadków użycia: Salon CRM

actor "Klient" as Client
actor "Pracownik" as Employee
actor "Administrator" as Admin

rectangle "Salon CRM" {
  usecase "Przeglądanie usług" as UC_ViewServices
  usecase "Przeglądanie pracowników" as UC_ViewEmployees
  usecase "Sprawdzenie wolnych terminów" as UC_CheckSlots
  usecase "Rezerwacja wizyty online" as UC_BookOnline
  usecase "Podanie danych kontaktowych" as UC_ContactData
  usecase "Otrzymanie potwierdzenia rezerwacji" as UC_BookingResult

  usecase "Logowanie do CRM" as UC_Login
  usecase "Przeglądanie panelu głównego" as UC_Dashboard
  usecase "Przeglądanie kalendarza wizyt" as UC_Calendar
  usecase "Przeglądanie klientów" as UC_Clients
  usecase "Przeglądanie płatności" as UC_Payments
  usecase "Przeglądanie opinii" as UC_Reviews
  usecase "Dodanie komentarza do wizyty" as UC_Comment
  usecase "Zmiana statusu wizyty" as UC_Status
  usecase "Przełożenie wizyty" as UC_Reschedule
  usecase "Rejestracja sprzedaży produktu" as UC_Sale

  usecase "Zarządzanie wizytami" as UC_ManageAppointments
  usecase "Zarządzanie usługami" as UC_ManageServices
  usecase "Zarządzanie kategoriami usług" as UC_ManageServiceCategories
  usecase "Zarządzanie pracownikami" as UC_ManageEmployees
  usecase "Zarządzanie portfolio" as UC_ManagePortfolio
  usecase "Zarządzanie produktami" as UC_ManageProducts
  usecase "Zarządzanie sprzedażą" as UC_ManageSales
  usecase "Zarządzanie ustawieniami salonu" as UC_Settings
  usecase "Kontrola stanów magazynowych" as UC_Stock
}

Client --> UC_ViewServices
Client --> UC_ViewEmployees
Client --> UC_CheckSlots
Client --> UC_BookOnline
Client --> UC_BookingResult

UC_BookOnline ..> UC_ViewServices : <<include>>
UC_BookOnline ..> UC_ViewEmployees : <<include>>
UC_BookOnline ..> UC_CheckSlots : <<include>>
UC_BookOnline ..> UC_ContactData : <<include>>

Employee --> UC_Login
Employee --> UC_Dashboard
Employee --> UC_Calendar
Employee --> UC_Clients
Employee --> UC_Payments
Employee --> UC_Reviews
Employee --> UC_Comment
Employee --> UC_Status
Employee --> UC_Reschedule
Employee --> UC_Sale

Admin --> UC_Login
Admin --> UC_Dashboard
Admin --> UC_Calendar
Admin --> UC_Clients
Admin --> UC_Payments
Admin --> UC_Reviews
Admin --> UC_ManageAppointments
Admin --> UC_ManageServices
Admin --> UC_ManageServiceCategories
Admin --> UC_ManageEmployees
Admin --> UC_ManagePortfolio
Admin --> UC_ManageProducts
Admin --> UC_ManageSales
Admin --> UC_Settings
Admin --> UC_Stock

UC_ManageAppointments ..> UC_Comment : <<include>>
UC_ManageAppointments ..> UC_Status : <<include>>
UC_ManageAppointments ..> UC_Reschedule : <<include>>
UC_ManageSales ..> UC_Sale : <<include>>
UC_ManageProducts ..> UC_Stock : <<include>>

@enduml
