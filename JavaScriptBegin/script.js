    function changeText(){
        document.getElementById("DynamicText").innerHTML= "Neuer Text";
    }
    function alert(){
        //alert("ALERT MELDUNG!");
    }
    function getRandomNumber(){
        //Werte ermitteln
        let min = Math.ceil( document.getElementById("minNumber").value );
        let max = Math.floor( document.getElementById("maxNumber").value );
        max += 1;
        //Zufallszahl ermitteln
        let random = randomMath(min,max);
        //Zufallszahl übergeben
        document.getElementById("randomNumber").innerHTML = random.toString();
    }

    function randomMath(min,max){
        //Differenz aus Min und Max mit Wert multiplizieren und auf Min drauf rechnen
        return Math.floor( Math.random() * ( max - min ) ) + min;
    }