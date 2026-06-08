@startuml
title User Flow: Product Sale in CRM

start

:Admin/Employee logs into the system;

:Open "Products" section;
:Search for product by name / SKU;

if (Product found?) then (Yes)
  :Check product stock level;

  if (Product in stock?) then (Yes)
    :Add product to sale;
    :Specify quantity;

    :System calculates the total amount;

    if (Client specified?) then (Yes)
      :Link sale to client;
    else (No)
      :Process sale without client;
    endif

    :Select payment method;
    :Confirm sale;

    :Create sale record;
    :Create sale items;
    :Deduct product stock;
    :Log inventory movement;

    if (Stock below minimum?) then (Yes)
      :Show low stock\nwarning;
    else (No)
      :Complete sale;
    endif

  else (No)
    :Show message\n"Product out of stock";
  endif

else (No)
  :Suggest adding a new product;
endif

stop
@enduml