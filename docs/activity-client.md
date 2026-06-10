@startuml
title Diagram procesu rezerwacji wizyty przez klienta

|Klient|
start
:Otwiera stronę rezerwacji online;
:Przegląda listę usług;
:Wybiera jedną lub kilka usług;
:Wybiera pracownika;
:Wybiera datę;

|Frontend|
:Wysyła zapytanie o dostępne terminy\nGET /api/availability;

|Backend|
:Sprawdza, czy wybrane usługi są aktywne;
if (Czy usługi są dostępne?) then (Tak)
  :Oblicza łączny czas trwania usług;
  :Pobiera godziny pracy pracownika\nw wybranym dniu;
  :Pobiera istniejące wizyty pracownika;
  :Usuwa terminy kolidujące\nz istniejącymi wizytami;
  :Zwraca listę wolnych terminów;
else (Nie)
  :Zwraca błąd walidacji;
endif

|Frontend|
if (Czy są wolne terminy?) then (Tak)
  :Wyświetla dostępne godziny;

  |Klient|
  :Wybiera godzinę;
  :Wprowadza imię, nazwisko,\ntelefon, email i komentarz;
  :Potwierdza rezerwację;

  |Frontend|
  :Wysyła żądanie utworzenia wizyty\nPOST /api/appointments;

  |Backend|
  :Sprawdza dane wejściowe;
  :Sprawdza aktywność usług;
  :Sprawdza, czy pracownik\nwykonuje wybrane usługi;
  :Oblicza godzinę zakończenia wizyty;
  :Sprawdza kolizję\nz istniejącymi wizytami;

  if (Czy termin jest nadal wolny?) then (Tak)
    :Tworzy klienta w tabeli users;
    :Tworzy wizytę w tabeli appointments;
    :Łączy wizytę z usługami\nw appointment_services;
    :Zwraca dane utworzonej wizyty;

    |Frontend|
    :Wyświetla potwierdzenie rezerwacji;

    |Klient|
    :Widzi informację o udanej rezerwacji;
  else (Nie)
    :Zwraca błąd konfliktu 409;

    |Frontend|
    :Wyświetla komunikat,\nże termin jest już zajęty;
    :Proponuje wybór innej godziny;
  endif
else (Nie)
  :Wyświetla komunikat,\nże brak wolnych terminów;
  :Proponuje wybór innej daty\nlub pracownika;
endif

stop
@enduml
