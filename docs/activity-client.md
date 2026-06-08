@startuml
title User Flow: Client Appointment Booking

start

:Open salon website;

:Browse services;
:Select one or multiple services;

:Select specialist;

:Select date;

:System checks salon schedule;
:System checks specialist schedule;
:System checks existing bookings;

if (Are slots available?) then (Yes)
  :Show available times;
  :Client selects a time slot;

  if (Is client logged in?) then (Yes)
    :Use account data;
  else (No)
    :Enter full name;
    :Enter phone number;
    :Enter email;
  endif

  :Confirm booking;

  :Create appointment in the system;
  :Assign services to appointment;
  :Send notification to client;
  :Show booking success page;

else (No)
  :Show message\n"No available time slots";
  :Suggest choosing another date;
endif

stop
@enduml