#Futuros 
# Como es el mercado

La mayor parte de las industrias/comerciales que operan futuros como cobertura, no importa cuanta especulación haya son los que mueven el mercado.
### Curva como operan las industrias 
Siempre les conviene la cobertura de corto plazo
![[Pasted image 20240907104221.png|249]]

En muchos futuros que hay mucha cobertura es el opuesto
![[Pasted image 20240907104325.png|250]]

los profesionales se cubren el tramo corto:
* liquidez
* demanda intrínseca / conveniencia
![[Pasted image 20240907104353.png|271]]

## Curvas de precios
Las curvas de Europa y estados unidos suelen verse así:
![[Pasted image 20240907114737.png|285]]
(Curva del problema - curva normalizada)

Hay curvas como el acero en china que podrían llegar a tener esta forma porque se concentran en los picos de delibery.
![[Pasted image 20240907113759.png|257]]
Entonces se pronuncia de acuerdo a si van tener pocas entregas o muchas entregas.
![[Pasted image 20240907114607.png|189]]
Esto se debe a que el mercado no esta tan desarrollado. El mercado se concentra mucho en cierto vencimientos y generan un caos.
## Como arbitrar la curva

Haciendo el roll over contra la curva de usa y ganaste plata.
![[Pasted image 20240907112700.png|283]]
Esto es algo que solo pueden hacer un fondo grande por los costos asociados.
## Los agentes

Los agentes quiere cubrirse de eso por eso cambian el contrato continuo antes de lo que lo haría un profesional, esto general gaps. Porque cuando esta por venir el roll over profesional. El final de futuro uno que te obliga a pasar al otro los precios tienden a coincidir.

Ahora como el transaccional que hace que te encuentren con 10 mil barriles de pretoleo en la puerta de tu casa y sino te cobran la penalidad por deposito, que es una fortuna.

Bastante antes del vencimiento (un par de semanas antes) se hace el roll over transaccional, algunos hasta avisándote en forma de disclaimer.
### ROFEX es un mal chiste

Los riegos de operar en mercados como el de ROFEX es que solo están abiertos mercados que operan las 24 horas en el horario local, potenciando perdidas y haciendo que se pierdan negocios.

## Roll over

Existe dos tipos de roll over, profesional y transaccional.

Línea de tiempo de un roll over.
![[Pasted image 20240907123944.png]]

Cuándo se hace el transaccional:
* La liquidez se va a perder **dramáticamente** en los vencimientos cortos.
* Los gráficos que hay que analizar no son los de roll over transaccional, en términos de contrato continuo, sino lo profesionales. Estos los otorga reuters Bloomberg o eSignal.

En un grafico diario de largo plazo del profesional podes ver un **verdadero desarrollo del mercado**.

## Contratos

* No son todos los vencimientos iguales, hay activos que tienen vencimiento todos los meses, otros 3 meses.
* Cada contrato tiene diferentes condiciones.
* Cada contrato tiene diferentes niveles de aplacamiento y margen.

Siempre hay que usar el frontmonth cuando faltan unos 14 dias al vencimiento, el sistema normalmente avisa como ninjatrader, el resto no lo hace.

Rick 2018 opera ES, gas, petroleo y yen.

## Margen

Cuando se operan contratos de petróleo por ejemplo, cada contrato tiene al rededor de 10 barriles, pero se opera con una fracción de lo que vale un barril de petróleo. El equivalente entre esos 2 valores.

### Tipos de margen

* Inicial:
	  Es la cantidad de dinero que hay que tener en la cuenta para abrir una posición.
* Mantenimiento:
	  Margen que requiere una posición abierta.
	  El margen inicial siempre va ser mayor que el de mantenimiento, pero hay que tener en cuenta que si una operación se mueve de forma adversa el margen de mantenimiento sube.
* Intradiario:
	  El margen intradiario es fijo siempre que se opere intradiario.

El margen Inicial y Mantenimiento es overnight.

El mercado siempre les va a imponer los margenes guias.

[Ninjatrader margen](https://ninjatrader.com/pricing/margins/)
Ejemplo de Ninjatrader 2018:
![[Pasted image 20240907133216.png|375]]
Ejemplo de Ninjatrader 2023:
![[Pasted image 20240907133113.png|375]]

De decires como "[[El banco es una institución nefasta]]", los márgenes funcionan igual. Todos van a querer que operes cantidades ingentes de contratos con ellos a menos que haya un martes 13. En el 2008, la ampliación de márgenes dejo fuera de juego a muchos operadores por no contar con suficiente capital.


## Tick

Es la distancia mínima del precio de un contrato.

El ES (SP500) y el NASDAQ tienen un tick de 0.25.

Si esta en 2000 su distancia mínima es 1999.75 o 2000.25. Cada tick equivale de $12.50 bruto mas la comisión.

El petróleo tiene un tick de 0.01, cada tick equivale a $10 bruto.

Cada tick se comporta diferente de acuerdo al activo.


## Apalancamiento

Es la conjunción entre el margen y los tick

### Apalancamiento y margen

Si usamos los margenes guias del 2023
Una operación intradiaria en el ES involucra 1000 usd de margen. Si la operacion es overnight son 16500 usd. Un 1650% mas para la misma operacion.

Si yo busco 2 puntos, estoy sobreapalancandome con el capital involucrado.


Por conveniencia es mejor operar ES que nasdaq porque cad tick de nasdaq equivale a $5. Ósea que por involucrar la misma cantidad de dinero, ganas menos. "minor bank for your rock"

## Agentes

* Full featured
	* Institucional
	* Muchos activos
	* Margenes mayores
	* Casi no hay costos
* Specialized
	* Agente pequeño (con pocos clientes)
	* Margenes bajos
		* Potencia retornos (y riesgos)
	* Te cobran por todo

Generalmente un agente especializado tiene un monto de apertura menor.

TOS
plataforma
datos


1.11.45