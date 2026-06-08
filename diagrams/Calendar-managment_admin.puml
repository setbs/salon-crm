@startuml
title User Flow: Calendar Management by Admin

start

:Admin logs into the system;
:Open "Calendar" section;

:Select date / week / month;
:System loads appointments;
:System displays free and booked slots;

if (Admin wants to create an appointment?) then (Yes)
  :Select client;
  :Select specialist;
  :Select one or multiple services;
  :Select an available slot;
  :Confirm booking;
  :System creates appointment;
  :System sends notification to client;

else (No)
  if (Admin wants to modify an appointment?) then (Yes)
    :Open appointment details;
    :Change time / services / status / comment;
    :Save changes;
    :System updates appointment;
    :System sends notification to client;

  else (No)
    if (Admin wants to cancel an appointment?) then (Yes)
      :Open appointment details;
      :Specify cancellation reason;
      :Confirm cancellation;
      :System changes status to cancelled;
      :System sends notification to client;
    else (No)
      :View calendar without changes;
    endif
  endif
endif

stop
@enduml