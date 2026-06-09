@startuml
left to right direction

actor Guest
actor Client
actor Employee
actor Admin

rectangle "Beauty Salon CRM" {

  usecase "View services" as UC1
  usecase "View portfolio" as UC2
  usecase "Check available slots" as UC3
  usecase "Book appointment\nwithout registration" as UC4

  usecase "Register" as UC5
  usecase "Log in" as UC6
  usecase "Book appointment" as UC7
  usecase "Cancel appointment" as UC8
  usecase "View appointment\nhistory" as UC9
  usecase "Leave review" as UC10

  usecase "View personal\nschedule" as UC11
  usecase "View appointment\ndetails" as UC12
  usecase "Add comment\nto visit" as UC13
  usecase "Add photo\nto portfolio" as UC14

  usecase "Manage services" as UC15
  usecase "Manage clients" as UC16
  usecase "Manage employees" as UC17
  usecase "Manage schedule" as UC18
  usecase "Manage appointments" as UC19
  usecase "Manage portfolio" as UC20
  usecase "View payments" as UC21
  usecase "View reviews" as UC22
  usecase "Change salon settings" as UC23

  usecase "Manage products" as UC24
  usecase "Manage product\ncategories" as UC25
  usecase "Track product inventory" as UC26
  usecase "Add product sale" as UC27
  usecase "View product sales" as UC28
  usecase "Monitor low stock" as UC29
  usecase "View products" as UC30

  usecase "View analytics\ndashboard" as UC31
  usecase "View revenue\nanalytics" as UC32
  usecase "View service\nanalytics" as UC33
  usecase "View product\nanalytics" as UC34
  usecase "View client\nanalytics" as UC35
  usecase "View employee\nanalytics" as UC36

  usecase "View reports" as UC37
  usecase "Export clients\nCSV" as UC38
  usecase "Export appointments\nCSV" as UC39
  usecase "Export product sales\nCSV" as UC40
  usecase "Export products\nCSV" as UC41
  usecase "Export revenue\nCSV" as UC42

  usecase "View notification\nlogs" as UC43
  usecase "Receive appointment\nreminders" as UC44
  usecase "Receive post-appointment\nnotifications" as UC45
}

Guest --> UC1
Guest --> UC2
Guest --> UC3
Guest --> UC4

Client --> UC1
Client --> UC2
Client --> UC3
Client --> UC5
Client --> UC6
Client --> UC7
Client --> UC8
Client --> UC9
Client --> UC10
Client --> UC44
Client --> UC45

Employee --> UC11
Employee --> UC12
Employee --> UC13
Employee --> UC14
Employee --> UC27
Employee --> UC30

Admin --> UC15
Admin --> UC16
Admin --> UC17
Admin --> UC18
Admin --> UC19
Admin --> UC20
Admin --> UC21
Admin --> UC22
Admin --> UC23
Admin --> UC24
Admin --> UC25
Admin --> UC26
Admin --> UC27
Admin --> UC28
Admin --> UC29
Admin --> UC30
Admin --> UC31
Admin --> UC32
Admin --> UC33
Admin --> UC34
Admin --> UC35
Admin --> UC36
Admin --> UC37
Admin --> UC38
Admin --> UC39
Admin --> UC40
Admin --> UC41
Admin --> UC42
Admin --> UC43

Admin --> UC11
Admin --> UC12
Admin --> UC13
Admin --> UC14

@enduml
